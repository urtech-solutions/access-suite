import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Link2,
  Map,
  Plus,
  Share2,
  UserRound,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import {
  createReservation,
  getCommonAreaCalendar,
  listCommonAreas,
  listReservations,
  rotateReservationLink,
  updateReservationHeadcount,
} from "@/services/mobile-app.service";
import type {
  CommonArea,
  CommonAreaAvailabilityWindow,
  CommonAreaDayAvailability,
  ReservationEntry,
} from "@/services/mobile-app.types";

type ScheduleInterval = {
  start: Date;
  end: Date;
  minutes: number;
  top: number;
  height: number;
};

type TimelineReservationBlock = ScheduleInterval & {
  reservation: ReservationEntry;
  blocking: boolean;
};

type AreaDaySchedule = {
  available: boolean;
  dayStart: Date | null;
  dayEnd: Date | null;
  totalMinutes: number;
  timelineHeight: number;
  markers: Array<{ label: string; top: number }>;
  dayReservations: ReservationEntry[];
  blocks: TimelineReservationBlock[];
  freeWindows: ScheduleInterval[];
  confirmedCount: number;
  pendingCount: number;
};

function formatReservationDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReservationDay(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTimelineDayLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTimelineDayParts(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return {
    weekday: date
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(".", "")
      .toUpperCase(),
    day: date.toLocaleDateString("pt-BR", { day: "2-digit" }),
  };
}

function formatHourLabel(value: Date | string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRange(start: Date | string, end: Date | string) {
  return `${formatHourLabel(start)} - ${formatHourLabel(end)}`;
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate(),
  )}`;
}

function addDays(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}

function createLocalDate(dayValue: string, timeValue: string) {
  return new Date(`${dayValue}T${timeValue}:00`);
}

function toTimeInputValue(value: Date) {
  return `${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`;
}

function toLocalDateTimeValue(value: Date) {
  return `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(
    value.getDate(),
  )}T${padNumber(value.getHours())}:${padNumber(value.getMinutes())}:00`;
}

function formatDurationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h${padNumber(remainder)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isBlockingReservation(status: ReservationEntry["status"]) {
  return status === "CONFIRMED" || status === "COMPLETED";
}

function isVisibleTimelineReservation(status: ReservationEntry["status"]) {
  return status !== "REJECTED" && status !== "CANCELLED";
}

function overlapsRange(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function buildDateRail(anchor: string, total = 7) {
  const offsetStart = -2;
  return Array.from({ length: total }, (_, index) =>
    addDays(anchor, index + offsetStart),
  );
}

function buildHourlyMarkers(
  dayStart: Date,
  dayEnd: Date,
  totalMinutes: number,
) {
  const markers: Array<{ label: string; top: number }> = [];
  const cursor = new Date(dayStart);

  while (cursor <= dayEnd) {
    const offset = (cursor.getTime() - dayStart.getTime()) / 60000;
    markers.push({
      label: formatHourLabel(cursor),
      top: clampNumber((offset / totalMinutes) * 100, 0, 100),
    });
    cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
  }

  const lastMarkerLabel = formatHourLabel(dayEnd);
  if (!markers.some((marker) => marker.label === lastMarkerLabel)) {
    markers.push({ label: lastMarkerLabel, top: 100 });
  }

  return markers;
}

function resolveAreaWindows(
  area: CommonArea,
  dayAvailability?: CommonAreaDayAvailability | null,
) {
  if (dayAvailability) {
    if (Array.isArray(dayAvailability.windows) && dayAvailability.windows.length) {
      return dayAvailability.windows;
    }

    if (dayAvailability.window) {
      return [dayAvailability.window];
    }

    return [];
  }

  if (!area.opening_time || !area.closing_time) {
    return [];
  }

  return [
    {
      opens_at: area.opening_time,
      closes_at: area.closing_time,
      duration_minutes:
        extractMinutes(area.closing_time) - extractMinutes(area.opening_time),
    },
  ];
}

function windowContainsRange(
  window: CommonAreaAvailabilityWindow,
  start: number,
  end: number,
) {
  return start >= extractMinutes(window.opens_at) && end <= extractMinutes(window.closes_at);
}

function buildAreaDaySchedule(
  area: CommonArea,
  reservations: ReservationEntry[],
  dayValue: string,
  dayAvailability?: CommonAreaDayAvailability | null,
): AreaDaySchedule {
  const windows = resolveAreaWindows(area, dayAvailability);
  const windowRanges = windows
    .map((window) => ({
      start: createLocalDate(dayValue, window.opens_at),
      end: createLocalDate(dayValue, window.closes_at),
    }))
    .filter((window) => window.end > window.start)
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  if (windowRanges.length === 0) {
    return {
      available: false,
      dayStart: null,
      dayEnd: null,
      totalMinutes: 0,
      timelineHeight: 320,
      markers: [],
      dayReservations: [],
      blocks: [],
      freeWindows: [],
      confirmedCount: 0,
      pendingCount: 0,
    };
  }

  const dayStart = windowRanges[0].start;
  const dayEnd = windowRanges[windowRanges.length - 1].end;
  const totalMinutes = Math.max(
    Math.round((dayEnd.getTime() - dayStart.getTime()) / 60000),
    60,
  );

  const dayReservations = reservations
    .filter(
      (reservation) =>
        reservation.area.id === area.id &&
        isVisibleTimelineReservation(reservation.status) &&
        windowRanges.some((window) =>
          overlapsRange(
            new Date(reservation.reserved_from),
            new Date(reservation.reserved_until),
            window.start,
            window.end,
          ),
        ),
    )
    .sort(
      (left, right) =>
        new Date(left.reserved_from).getTime() -
        new Date(right.reserved_from).getTime(),
    );

  const blocks: TimelineReservationBlock[] = dayReservations.map(
    (reservation) => {
      const originalStart = new Date(reservation.reserved_from);
      const originalEnd = new Date(reservation.reserved_until);
      const start = new Date(
        Math.max(originalStart.getTime(), dayStart.getTime()),
      );
      const end = new Date(Math.min(originalEnd.getTime(), dayEnd.getTime()));
      const minutes = Math.max(
        Math.round((end.getTime() - start.getTime()) / 60000),
        30,
      );

      return {
        reservation,
        start,
        end,
        minutes,
        top:
          ((start.getTime() - dayStart.getTime()) / 60000 / totalMinutes) * 100,
        height: clampNumber((minutes / totalMinutes) * 100, 8, 100),
        blocking: isBlockingReservation(reservation.status),
      };
    },
  );

  const freeWindows: ScheduleInterval[] = [];
  for (const window of windowRanges) {
    const blockingIntervals = blocks
      .filter(
        (block) =>
          block.blocking &&
          overlapsRange(block.start, block.end, window.start, window.end),
      )
      .map((block) => ({
        start: new Date(Math.max(block.start.getTime(), window.start.getTime())),
        end: new Date(Math.min(block.end.getTime(), window.end.getTime())),
      }))
      .sort((left, right) => left.start.getTime() - right.start.getTime());

    const mergedBlocking: Array<{ start: Date; end: Date }> = [];
    for (const interval of blockingIntervals) {
      const last = mergedBlocking[mergedBlocking.length - 1];
      if (!last || interval.start > last.end) {
        mergedBlocking.push({ ...interval });
        continue;
      }

      if (interval.end > last.end) {
        last.end = interval.end;
      }
    }

    let cursor = window.start;
    for (const interval of mergedBlocking) {
      if (interval.start > cursor) {
        const minutes = Math.round(
          (interval.start.getTime() - cursor.getTime()) / 60000,
        );
        freeWindows.push({
          start: new Date(cursor),
          end: new Date(interval.start),
          minutes,
          top:
            ((cursor.getTime() - dayStart.getTime()) / 60000 / totalMinutes) *
            100,
          height: (minutes / totalMinutes) * 100,
        });
      }

      if (interval.end > cursor) {
        cursor = interval.end;
      }
    }

    if (cursor < window.end) {
      const minutes = Math.round((window.end.getTime() - cursor.getTime()) / 60000);
      freeWindows.push({
        start: new Date(cursor),
        end: new Date(window.end),
        minutes,
        top:
          ((cursor.getTime() - dayStart.getTime()) / 60000 / totalMinutes) *
          100,
        height: (minutes / totalMinutes) * 100,
      });
    }
  }

  const confirmedCount = dayReservations.filter((reservation) =>
    isBlockingReservation(reservation.status),
  ).length;
  const pendingCount = dayReservations.filter(
    (reservation) => reservation.status === "PENDING_APPROVAL",
  ).length;
  const timelineHeight = Math.max(Math.round((totalMinutes / 60) * 42), 320);

  return {
    available: true,
    dayStart,
    dayEnd,
    totalMinutes,
    timelineHeight,
    markers: buildHourlyMarkers(dayStart, dayEnd, totalMinutes),
    dayReservations,
    blocks,
    freeWindows,
    confirmedCount,
    pendingCount,
  };
}

function buildReservationWindow(
  dateValue: string,
  startTime: string,
  durationHours: number,
) {
  const localStart = new Date(`${dateValue}T${startTime}:00`);
  const localEnd = new Date(
    localStart.getTime() + durationHours * 60 * 60 * 1000,
  );
  return {
    reserved_from: toLocalDateTimeValue(localStart),
    reserved_until: toLocalDateTimeValue(localEnd),
  };
}

function extractMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function canFitAreaWindow(
  area: CommonArea | undefined,
  startTime: string,
  durationHours: number,
  dayAvailability?: CommonAreaDayAvailability | null,
) {
  if (!area || !startTime || !durationHours) {
    return true;
  }

  const start = extractMinutes(startTime);
  const end = start + durationHours * 60;
  return resolveAreaWindows(area, dayAvailability).some((window) =>
    windowContainsRange(window, start, end),
  );
}

function copyTextFallback(text: string) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.writeText &&
    window.isSecureContext
  ) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return Promise.resolve(copied);
  } catch {
    window.prompt("Copie manualmente o link da reserva:", text);
    return Promise.resolve(false);
  }
}

function reservationStatusMeta(status: ReservationEntry["status"]) {
  if (status === "PENDING_APPROVAL") {
    return {
      label: "Pendente",
      variant: "warning" as const,
      tone: "text-warning",
      helper: "Aguardando validação da gestão",
    };
  }
  if (status === "CONFIRMED") {
    return {
      label: "Confirmada",
      variant: "success" as const,
      tone: "text-success",
      helper: "Horário indisponível para outros moradores",
    };
  }
  if (status === "REJECTED") {
    return {
      label: "Rejeitada",
      variant: "destructive" as const,
      tone: "text-destructive",
      helper: "Solicitação não aprovada",
    };
  }
  if (status === "CANCELLED") {
    return {
      label: "Cancelada",
      variant: "destructive" as const,
      tone: "text-destructive",
      helper: "Reserva cancelada",
    };
  }
  return {
    label: "Concluída",
    variant: "secondary" as const,
    tone: "text-muted-foreground",
    helper: "Evento já finalizado",
  };
}

const CommonAreasPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const canCreateReservation = resident.role !== "SINDICO";
  const todayValue = useMemo(() => toDateInputValue(new Date()), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timelineAreaId, setTimelineAreaId] = useState<number | null>(null);
  const [timelineDate, setTimelineDate] = useState(todayValue);
  const [dayMapExpanded, setDayMapExpanded] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [eventName, setEventName] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState("2");
  const [guestCount, setGuestCount] = useState("10");
  const [notes, setNotes] = useState("");
  const [editingHeadcountId, setEditingHeadcountId] = useState<number | null>(
    null,
  );
  const [headcountDraft, setHeadcountDraft] = useState("1");

  const areasQuery = useQuery({
    queryKey: ["common-areas", snapshot.mode, connectionState],
    queryFn: () => listCommonAreas(snapshot, connectionState),
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", resident.id, snapshot.mode, connectionState],
    queryFn: () => listReservations(snapshot, connectionState, resident),
  });

  const replaceReservation = (updated: ReservationEntry) => {
    queryClient.setQueryData<ReservationEntry[]>(
      ["reservations", resident.id, snapshot.mode, connectionState],
      (current = []) =>
        current.map((reservation) =>
          reservation.id === updated.id
            ? { ...reservation, ...updated }
            : reservation,
        ),
    );
  };

  const createReservationMutation = useMutation({
    mutationFn: async () => {
      const selectedArea = areasQuery.data?.find(
        (area) => area.id === Number(selectedAreaId),
      );
      const duration = Number(durationHours);

      if (!reservationDate || !startTime || !duration || !selectedArea) {
        throw new Error("Preencha data, horário e área para continuar.");
      }

      if (selectedAreaCalendarPending) {
        throw new Error("Consultando a agenda do dia. Aguarde um instante.");
      }

      if (
        !canFitAreaWindow(
          selectedArea,
          startTime,
          duration,
          selectedAreaDayAvailability,
        )
      ) {
        throw new Error(
          selectedAreaDayAvailability?.is_closed
            ? "A área está fechada na data selecionada."
            : "A reserva precisa caber dentro do horário de funcionamento da área.",
        );
      }

      return createReservation(
        snapshot,
        connectionState,
        resident,
        areasQuery.data ?? [],
        {
          area_id: Number(selectedAreaId),
          event_name: eventName.trim(),
          guest_count: Number(guestCount),
          ...buildReservationWindow(reservationDate, startTime, duration),
          notes: notes.trim() || undefined,
        },
      );
    },
    onSuccess: (created) => {
      toast.success(
        created.status === "PENDING_APPROVAL"
          ? "Solicitação enviada para aprovação."
          : "Reserva confirmada com link pronto para convidados.",
      );
      setDialogOpen(false);
      setSelectedAreaId("");
      setEventName("");
      setReservationDate("");
      setStartTime("");
      setDurationHours("2");
      setGuestCount("10");
      setNotes("");
      queryClient.invalidateQueries({
        queryKey: ["reservations", resident.id],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível registrar a reserva.",
      );
    },
  });

  const rotateReservationLinkMutation = useMutation({
    mutationFn: (reservationId: number) =>
      rotateReservationLink(snapshot, connectionState, resident, reservationId),
    onSuccess: (updated) => {
      if (updated) {
        replaceReservation(updated);
      }
    },
  });

  const updateHeadcountMutation = useMutation({
    mutationFn: ({
      reservationId,
      guest_count,
    }: {
      reservationId: number;
      guest_count: number;
    }) =>
      updateReservationHeadcount(
        snapshot,
        connectionState,
        resident,
        reservationId,
        {
          guest_count,
        },
      ),
    onSuccess: (updated) => {
      if (updated) {
        replaceReservation(updated);
        toast.success("Quantidade de pessoas atualizada.");
      }
      setEditingHeadcountId(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível atualizar a quantidade.",
      );
    },
  });

  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);
  const reservations = useMemo(
    () => reservationsQuery.data ?? [],
    [reservationsQuery.data],
  );
  const availableAreas = areas.filter((area) => area.status === "ACTIVE");
  const selectedArea = availableAreas.find(
    (area) => area.id === Number(selectedAreaId),
  );
  const selectedAreaCalendarQuery = useQuery({
    queryKey: [
      "common-area-calendar",
      selectedArea?.id ?? null,
      reservationDate,
      snapshot.mode,
      connectionState,
    ],
    enabled: Boolean(selectedArea && reservationDate),
    queryFn: () =>
      getCommonAreaCalendar(snapshot, connectionState, selectedArea!.id, {
        from: reservationDate,
      }),
  });
  const requestedDuration = Number(durationHours || "0");
  const requestedGuests = Number(guestCount || "0");
  const selectedAreaDayAvailability =
    selectedAreaCalendarQuery.data?.days?.[0] ?? null;
  const scheduleFits = canFitAreaWindow(
    selectedArea,
    startTime,
    requestedDuration,
    selectedAreaDayAvailability,
  );
  const capacityExceeded =
    Boolean(selectedArea?.capacity) &&
    requestedGuests > Number(selectedArea.capacity);
  const timelineArea = areas.find((area) => area.id === timelineAreaId) ?? null;
  const timelineCalendarQuery = useQuery({
    queryKey: [
      "common-area-calendar",
      timelineArea?.id ?? null,
      timelineDate,
      snapshot.mode,
      connectionState,
    ],
    enabled: Boolean(timelineArea && timelineDate),
    queryFn: () =>
      getCommonAreaCalendar(snapshot, connectionState, timelineArea!.id, {
        from: timelineDate,
      }),
  });
  const timelineDayAvailability = timelineCalendarQuery.data?.days?.[0] ?? null;
  const selectedAreaCalendarPending =
    Boolean(selectedArea && reservationDate) &&
    (selectedAreaCalendarQuery.isLoading || selectedAreaCalendarQuery.isFetching);

  const myReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) => reservation.person.id === resident.id,
      ),
    [reservations, resident.id],
  );

  const timelineReservations = useMemo(
    () =>
      [...reservations].sort(
        (left, right) =>
          new Date(left.reserved_from).getTime() -
          new Date(right.reserved_from).getTime(),
      ),
    [reservations],
  );

  const summary = useMemo(
    () => ({
      activeAreas: availableAreas.length,
      myOpen: myReservations.filter(
        (reservation) =>
          reservation.status === "PENDING_APPROVAL" ||
          reservation.status === "CONFIRMED",
      ).length,
      timelineCount: timelineReservations.filter(
        (reservation) => reservation.status === "CONFIRMED",
      ).length,
    }),
    [availableAreas.length, myReservations, timelineReservations],
  );

  const timelineSchedule = useMemo(
    () =>
      timelineArea
        ? buildAreaDaySchedule(
            timelineArea,
            timelineDayAvailability?.reservations ?? reservations,
            timelineDate,
            timelineDayAvailability,
          )
        : null,
    [timelineArea, reservations, timelineDate, timelineDayAvailability],
  );

  const draftConflictSummary = useMemo(() => {
    if (
      !selectedArea ||
      !reservationDate ||
      !startTime ||
      requestedDuration < 1
    ) {
      return null;
    }

    const schedule = buildAreaDaySchedule(
      selectedArea,
      selectedAreaDayAvailability?.reservations ?? reservations,
      reservationDate,
      selectedAreaDayAvailability,
    );
    const draftStart = createLocalDate(reservationDate, startTime);
    const draftEnd = new Date(
      draftStart.getTime() + requestedDuration * 60 * 60 * 1000,
    );

    const overlaps = schedule.dayReservations.filter((reservation) =>
      overlapsRange(
        new Date(reservation.reserved_from),
        new Date(reservation.reserved_until),
        draftStart,
        draftEnd,
      ),
    );

    const confirmed = overlaps.filter((reservation) =>
      isBlockingReservation(reservation.status),
    );
    const pending = overlaps.filter(
      (reservation) => reservation.status === "PENDING_APPROVAL",
    );
    const suggestedWindows = schedule.freeWindows.filter(
      (window) => window.minutes >= requestedDuration * 60,
    );

    return {
      confirmed,
      pending,
      suggestedWindows,
    };
  }, [
    selectedArea,
    selectedAreaDayAvailability,
    reservationDate,
    startTime,
    requestedDuration,
    reservations,
  ]);

  const hasBlockingDraftConflict = Boolean(
    draftConflictSummary?.confirmed.length,
  );

  const openAreaTimeline = (area: CommonArea) => {
    setTimelineAreaId(area.id);
    setDayMapExpanded(false);
    setTimelineDate(
      selectedAreaId === String(area.id) && reservationDate
        ? reservationDate
        : todayValue,
    );
  };

  const startReservationForArea = (area: CommonArea) => {
    setTimelineAreaId(null);
    setSelectedAreaId(String(area.id));
    if (!reservationDate) {
      setReservationDate(timelineDate || todayValue);
    }
    setDialogOpen(true);
  };

  const applySuggestedWindow = (window: ScheduleInterval) => {
    setReservationDate(toDateInputValue(window.start));
    setStartTime(toTimeInputValue(window.start));
  };

  const ensureReservationLink = async (reservation: ReservationEntry) => {
    if (reservation.public_link) {
      return {
        reservation,
        generatedNow: false,
      };
    }

    const rotated = await rotateReservationLinkMutation.mutateAsync(
      reservation.id,
    );
    if (!rotated) {
      throw new Error("Não foi possível gerar o link dos convidados.");
    }

    return {
      reservation: rotated,
      generatedNow: true,
    };
  };

  const buildReservationShareText = (reservation: ReservationEntry) => {
    if (reservation.public_link) {
      return `Link da reserva ${reservation.event_name}: ${reservation.public_link}`;
    }

    return `Reserva ${reservation.event_name}`;
  };

  const handleCopyLink = async (reservation: ReservationEntry) => {
    if (reservation.status !== "CONFIRMED") {
      toast.message("O link ficará disponível após a aprovação da reserva.");
      return;
    }

    try {
      const { reservation: resolvedReservation } =
        await ensureReservationLink(reservation);
      const copied = await copyTextFallback(
        buildReservationShareText(resolvedReservation),
      );
      toast.success(
        copied ? "Link da reserva copiado." : "Link pronto para cópia manual.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível copiar o link.",
      );
    }
  };

  const handleShareLink = async (reservation: ReservationEntry) => {
    if (reservation.status !== "CONFIRMED") {
      toast.message("O link ficará disponível após a aprovação da reserva.");
      return;
    }

    try {
      const { reservation: resolvedReservation, generatedNow } =
        await ensureReservationLink(reservation);
      const shareText = buildReservationShareText(resolvedReservation);

      if (generatedNow) {
        const copied = await copyTextFallback(shareText);
        toast.success(
          copied
            ? "Link gerado e copiado. Toque novamente em compartilhar para abrir o menu do celular."
            : "Link gerado. Compartilhe manualmente se o menu nativo não abrir.",
        );
        return;
      }

      if (navigator.share) {
        try {
          await navigator.share({
            text: shareText,
            url: resolvedReservation.public_link ?? undefined,
          });
          return;
        } catch {
          // Falls back to copy.
        }
      }

      const copied = await copyTextFallback(shareText);
      toast.success(
        copied
          ? "Link da reserva copiado."
          : "Link pronto para compartilhamento manual.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível compartilhar o link.",
      );
    }
  };

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Áreas comuns"
        subtitle={
          canCreateReservation
            ? "Agenda do condomínio, solicitações pendentes e link único dos convidados."
            : "Visão consolidada das áreas e reservas do site ativo."
        }
        backTo="/"
        action={
          canCreateReservation ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="accent" size="sm" className="rounded-full">
                  <Plus className="h-4 w-4" />
                  Nova reserva
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm rounded-[28px]">
                <DialogHeader>
                  <DialogTitle>Solicitar reserva</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Área comum</Label>
                    <select
                      className="flex h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none"
                      value={selectedAreaId}
                      onChange={(event) =>
                        setSelectedAreaId(event.target.value)
                      }
                    >
                      <option value="">Selecione uma área</option>
                      {availableAreas.map((area) => (
                        <option key={area.id} value={String(area.id)}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome do evento</Label>
                    <Input
                      value={eventName}
                      onChange={(event) => setEventName(event.target.value)}
                      placeholder="Ex.: Aniversário da Lara"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={reservationDate}
                        onChange={(event) =>
                          setReservationDate(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora inicial</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Duração (horas)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={durationHours}
                        onChange={(event) =>
                          setDurationHours(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de pessoas</Label>
                      <Input
                        type="number"
                        min={1}
                        value={guestCount}
                        onChange={(event) => setGuestCount(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observação</Label>
                    <Input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Detalhes importantes da reserva."
                    />
                  </div>

                  {selectedArea && reservationDate ? (
                    <div className="rounded-[18px] border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {selectedAreaCalendarPending ? (
                        "Consultando a janela efetiva desta data..."
                      ) : selectedAreaDayAvailability?.is_closed ? (
                        "A área está fechada na data selecionada."
                      ) : draftConflictSummary?.suggestedWindows.length ? (
                        <>
                          Janela válida do dia:{" "}
                          {draftConflictSummary.suggestedWindows
                            .map((window) =>
                              formatTimeRange(window.start, window.end),
                            )
                            .join(" · ")}
                        </>
                      ) : (
                        "Não foi possível resolver uma janela disponível para esta data."
                      )}
                    </div>
                  ) : null}

                  {!scheduleFits ? (
                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {selectedAreaDayAvailability?.is_closed
                        ? "A área está fechada na data selecionada."
                        : "O período precisa caber no horário de funcionamento da área."}
                    </div>
                  ) : null}

                  {capacityExceeded ? (
                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      A quantidade de pessoas excede a capacidade máxima da
                      área.
                    </div>
                  ) : null}

                  {draftConflictSummary?.confirmed.length ? (
                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                      <p className="font-semibold">
                        Conflito de agenda detectado
                      </p>
                      <p className="mt-1">
                        Este horário colide com{" "}
                        {draftConflictSummary.confirmed
                          .map((reservation) => reservation.event_name)
                          .join(", ")}
                        .
                      </p>
                    </div>
                  ) : null}

                  {!hasBlockingDraftConflict &&
                  draftConflictSummary?.pending.length ? (
                    <div className="rounded-[18px] border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
                      <p className="font-semibold">
                        Solicitação pendente no mesmo período
                      </p>
                      <p className="mt-1">
                        Há pedido em análise neste horário. Enquanto não for
                        aprovado, a janela continua disponível.
                      </p>
                    </div>
                  ) : null}

                  {!hasBlockingDraftConflict &&
                  !draftConflictSummary?.pending.length &&
                  draftConflictSummary?.suggestedWindows.length ? (
                    <div className="rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700">
                      <p className="font-semibold">
                        Janela compatível identificada
                      </p>
                      <p className="mt-1">
                        Melhor faixa livre:{" "}
                        {formatTimeRange(
                          draftConflictSummary.suggestedWindows[0].start,
                          draftConflictSummary.suggestedWindows[0].end,
                        )}
                        .
                      </p>
                    </div>
                  ) : null}

                  {(hasBlockingDraftConflict ||
                    draftConflictSummary?.pending.length) &&
                  draftConflictSummary?.suggestedWindows.length ? (
                    <div className="rounded-[18px] border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">
                        Faixas livres sugeridas
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {draftConflictSummary.suggestedWindows
                          .slice(0, 3)
                          .map((window) => (
                            <Button
                              key={`${window.start.toISOString()}-${window.end.toISOString()}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => applySuggestedWindow(window)}
                            >
                              {formatTimeRange(window.start, window.end)}
                            </Button>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    variant="accent"
                    className="w-full"
                    disabled={
                      !selectedAreaId ||
                      !eventName.trim() ||
                      !reservationDate ||
                      !startTime ||
                      Number(durationHours) < 1 ||
                      Number(guestCount) < 1 ||
                      selectedAreaCalendarPending ||
                      !scheduleFits ||
                      hasBlockingDraftConflict ||
                      capacityExceeded ||
                      createReservationMutation.isPending
                    }
                    onClick={() => createReservationMutation.mutate()}
                  >
                    Solicitar reserva
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Badge variant="warning">Somente leitura</Badge>
          )
        }
      />

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Áreas ativas
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {summary.activeAreas}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Minhas em aberto
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {summary.myOpen}
          </p>
        </div>
        <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Agenda confirmada
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {summary.timelineCount}
          </p>
        </div>
      </section>

      <Dialog
        open={Boolean(timelineArea)}
        onOpenChange={(open) => {
          if (!open) {
            setTimelineAreaId(null);
          }
        }}
      >
        {timelineArea && timelineSchedule ? (
          <DialogContent className="max-h-[94vh] w-[min(430px,calc(100vw-0.75rem))] max-w-[min(430px,calc(100vw-0.75rem))] overflow-y-auto rounded-[24px] border-border/80 bg-[#f8fafc] p-0 shadow-2xl">
            <div className="overflow-hidden rounded-[24px] pb-16">
              <div className="border-b border-border/70 bg-white px-3.5 pb-3.5 pr-10 pt-4">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Radar da area
                      </p>
                      <DialogTitle className="mt-1 text-xl font-semibold text-foreground">
                        {timelineArea.name}
                      </DialogTitle>
                    </div>
                    <Badge
                      variant={
                        !timelineSchedule.available
                          ? "destructive"
                          : timelineSchedule.confirmedCount > 0
                          ? "warning"
                          : "success"
                      }
                      className="mt-3 shrink-0 rounded-full px-2.5 py-1 text-[11px]"
                    >
                      {!timelineSchedule.available
                        ? "Área fechada"
                        : timelineSchedule.confirmedCount > 0
                        ? `${timelineSchedule.confirmedCount} bloqueio(s)`
                        : "Dia livre"}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex min-w-0 items-center gap-2 rounded-[12px] border border-border bg-white px-2.5 py-2.5 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        Confirmadas
                      </p>
                      <p className="text-lg font-semibold leading-none text-foreground">
                        {timelineSchedule.confirmedCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-[12px] border border-border bg-white px-2.5 py-2.5 shadow-sm">
                    <Clock3 className="h-5 w-5 shrink-0 text-warning" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        Pendentes
                      </p>
                      <p className="text-lg font-semibold leading-none text-foreground">
                        {timelineSchedule.pendingCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-border/70 bg-white px-3.5 py-2">
                <div className="grid grid-cols-[36px,1fr,36px] items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => setTimelineDate(addDays(timelineDate, -1))}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="grid grid-cols-7 gap-1">
                    {buildDateRail(timelineDate).map((dayValue) => {
                      const dayParts = formatTimelineDayParts(dayValue);

                      return (
                        <button
                          key={dayValue}
                          type="button"
                          onClick={() => setTimelineDate(dayValue)}
                          className={`relative flex min-h-[50px] min-w-0 flex-col items-center justify-center rounded-[13px] border text-center transition ${
                            timelineDate === dayValue
                              ? "border-foreground bg-foreground text-background shadow-sm"
                              : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="text-[10px] font-semibold leading-none">
                            {dayParts.weekday}
                          </span>
                          <span className="mt-1 text-lg font-semibold leading-none">
                            {dayParts.day}
                          </span>
                          {timelineDate === dayValue ? (
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => setTimelineDate(addDays(timelineDate, 1))}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>

                <div className="space-y-3.5 px-3.5 py-3.5">
                {!timelineSchedule.available ? (
                  <div className="rounded-[14px] border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
                    Esta área não possui janela reservável na data selecionada.
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span>Dia analisado</span>
                  </div>
                  <label className="relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full bg-foreground px-3 py-2 text-[11px] font-semibold text-background shadow-sm">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatTimelineDayLabel(timelineDate)}
                    <Input
                      type="date"
                      value={timelineDate}
                      onChange={(event) => setTimelineDate(event.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>

                <div className="rounded-[16px] border border-border bg-white p-3 shadow-sm">
                  <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
                    <h3 className="text-base font-semibold text-foreground">
                      Radar de disponibilidade
                    </h3>
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-success" />
                        Livre
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-destructive" />
                        Bloqueado
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm bg-warning" />
                        Pendente
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[42px,1fr] gap-2">
                    <div
                      className="relative text-[11px] text-muted-foreground"
                      style={{ height: `${timelineSchedule.timelineHeight}px` }}
                    >
                      {timelineSchedule.markers.map((marker) => (
                        <span
                          key={`${marker.label}-${marker.top}`}
                          className="absolute -translate-y-1/2"
                          style={{ top: `${marker.top}%` }}
                        >
                          {marker.label}
                        </span>
                      ))}
                    </div>

                    <div
                      className="relative overflow-hidden rounded-[2px] border-l border-border/80 bg-[#f8fbfa]"
                      style={{ height: `${timelineSchedule.timelineHeight}px` }}
                    >
                      {timelineSchedule.markers.map((marker) => (
                        <div
                          key={`line-${marker.label}-${marker.top}`}
                          className="absolute left-0 right-0 border-t border-dashed border-border/80"
                          style={{ top: `${marker.top}%` }}
                        />
                      ))}

                      {timelineSchedule.freeWindows.map((window, index) => (
                        <div
                          key={`free-${window.start.toISOString()}-${index}`}
                          className="absolute left-0 right-0 border-l-4 border-success bg-success/8 px-3 py-1.5 text-[11px]"
                          style={{
                            top: `${window.top}%`,
                            height: `${clampNumber(window.height, 6, 100)}%`,
                          }}
                        >
                          <p className="font-medium text-muted-foreground">
                            {formatTimeRange(window.start, window.end)}
                          </p>
                          <p className="mt-1 font-semibold text-success">
                            Livre
                          </p>
                        </div>
                      ))}

                      {timelineSchedule.blocks.map((block) => {
                        const status = reservationStatusMeta(
                          block.reservation.status,
                        );
                        const unitLabel = [
                          block.reservation.person.residence_block,
                          block.reservation.person.residence_apartment,
                        ]
                          .filter(Boolean)
                          .join(" • ");

                        return (
                          <div
                            key={`block-${block.reservation.id}`}
                            className={`absolute left-0 right-0 border-l-4 px-3 py-1.5 text-left ${
                              block.blocking
                                ? "border-destructive bg-destructive/10 text-destructive"
                                : "border-warning bg-warning/10 text-warning"
                            }`}
                            style={{
                              top: `${block.top}%`,
                              height: `${block.height}%`,
                            }}
                          >
                            <div className="flex h-full items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium leading-tight text-muted-foreground">
                                  {formatTimeRange(block.start, block.end)}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold leading-tight">
                                  {block.blocking ? "Reservado" : status.label}
                                </p>
                              </div>
                              <span className="inline-flex shrink-0 items-center gap-2 text-xs text-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <UserRound className="h-4 w-4" />
                                  {block.reservation.guest_count}
                                </span>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </span>
                            </div>
                            <p className="sr-only">
                              {block.reservation.guest_count} pessoa(s)
                              {unitLabel ? ` · ${unitLabel}` : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {timelineSchedule.freeWindows.length === 0 ? (
                  <div className="flex items-center gap-2.5 rounded-[14px] border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-destructive">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-xs font-medium leading-snug">
                      Nao existe janela livre dentro do horario de funcionamento
                      neste dia.
                    </p>
                  </div>
                ) : null}

                {timelineSchedule.pendingCount > 0 ? (
                  <div className="rounded-[14px] border border-warning/20 bg-warning/10 px-3.5 py-3 text-[11px] font-medium text-warning">
                    Existem {timelineSchedule.pendingCount} solicitacao(oes)
                    pendente(s) neste dia. Elas aparecem no radar, mas ainda nao
                    bloqueiam a agenda.
                  </div>
                ) : null}

                <button
                  type="button"
                  aria-expanded={dayMapExpanded}
                  onClick={() => setDayMapExpanded((current) => !current)}
                  className="flex w-full items-center justify-between rounded-[14px] border border-border bg-white px-3.5 py-3.5 text-left shadow-sm transition hover:bg-muted/30"
                >
                  <span className="text-base font-semibold text-foreground">
                    Mapa do dia
                  </span>
                  <span className="inline-flex items-center gap-2.5 text-foreground">
                    <Map className="h-[18px] w-[18px]" />
                    <ChevronRight className="h-[18px] w-[18px]" />
                  </span>
                </button>

                {dayMapExpanded ? (
                  <div className="grid gap-1.5 rounded-[14px] border border-border bg-white p-2.5 text-[11px] text-muted-foreground shadow-sm">
                    {timelineSchedule.freeWindows.length > 0 ? (
                      timelineSchedule.freeWindows.map((window, index) => (
                        <div
                          key={`map-free-${window.start.toISOString()}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-[12px] bg-success/8 px-3 py-2 text-success"
                        >
                          <span>{formatTimeRange(window.start, window.end)}</span>
                          <span>{formatDurationLabel(window.minutes)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[12px] bg-destructive/10 px-3 py-2 text-destructive">
                        Sem janelas livres para este dia.
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">
                    Reservas deste dia
                  </h3>

                  {timelineSchedule.dayReservations.length > 0 ? (
                    timelineSchedule.dayReservations.map((reservation) => {
                      const status = reservationStatusMeta(reservation.status);
                      const unitLabel = [
                        reservation.person.residence_block,
                        reservation.person.residence_apartment,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <div
                          key={`schedule-row-${reservation.id}`}
                          className="grid grid-cols-[70px,48px,1fr,22px] items-center overflow-hidden rounded-[14px] border border-border bg-white shadow-sm"
                        >
                          <div
                            className={`h-full border-l-4 px-2.5 py-2.5 ${
                              isBlockingReservation(reservation.status)
                                ? "border-destructive bg-destructive/5"
                                : "border-warning bg-warning/5"
                            }`}
                          >
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {formatHourLabel(reservation.reserved_from)}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                              {formatHourLabel(reservation.reserved_until)}
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 px-1.5 text-xs font-medium text-foreground">
                            <UserRound className="h-3.5 w-3.5" />
                            {reservation.guest_count}
                          </div>
                          <div className="min-w-0 px-2 py-2.5">
                            <p className={`text-xs ${status.tone}`}>{status.label}</p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {status.helper}
                            </p>
                            <span className="sr-only">{unitLabel}</span>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-border bg-white px-3.5 py-3.5 text-[11px] text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Nenhuma reserva visivel neste dia para esta area.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {canCreateReservation ? (
              <div className="sticky bottom-0 border-t border-border/70 bg-white/95 px-3.5 py-3 backdrop-blur">
                <Button
                  variant="accent"
                  className="h-11 w-full rounded-[12px] text-sm font-semibold"
                  onClick={() => startReservationForArea(timelineArea)}
                >
                  <CalendarDays className="h-[18px] w-[18px]" />
                  Reservar esta area
                </Button>
              </div>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Áreas disponíveis
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada ambiente mostra janela de funcionamento, capacidade e regra de
            aprovação.
          </p>
        </div>

        {areas.map((area, index) => {
          return (
            <motion.button
              type="button"
              key={area.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => openAreaTimeline(area)}
              className="w-full rounded-[28px] border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  {area.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {area.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Agenda do condomínio
          </h2>
          <p className="text-sm text-muted-foreground">
            Aqui aparecem as reservas que já ocupam horário para os moradores do
            site.
          </p>
        </div>

        {timelineReservations.map((reservation, index) => {
          const status = reservationStatusMeta(reservation.status);
          const unitLabel = [
            reservation.person.residence_block,
            reservation.person.residence_apartment,
          ]
            .filter(Boolean)
            .join(" • ");

          return (
            <motion.div
              key={`timeline-${reservation.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + index * 0.03 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {formatReservationDay(reservation.reserved_from)}
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {reservation.event_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reservation.area.name} ·{" "}
                    {formatReservationDate(reservation.reserved_from)} até{" "}
                    {formatReservationDate(reservation.reserved_until)}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-3 py-1">
                  {reservation.guest_count} pessoa(s)
                </span>
                {unitLabel ? (
                  <span className="rounded-full bg-muted px-3 py-1">
                    {unitLabel}
                  </span>
                ) : null}
                {reservation.person.id === resident.id ? (
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-accent-foreground">
                    Minha reserva
                  </span>
                ) : null}
              </div>
            </motion.div>
          );
        })}

        {timelineReservations.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma reserva visível no momento para este site.
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Minhas reservas
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status, ajuste a lotação durante o evento e compartilhe
            o link único dos convidados.
          </p>
        </div>

        {myReservations.map((reservation, index) => {
          const status = reservationStatusMeta(reservation.status);
          const isDuringEvent =
            reservation.status === "CONFIRMED" &&
            new Date(reservation.reserved_from) <= new Date() &&
            new Date(reservation.reserved_until) >= new Date();
          const currentHeadcountValue = Number(
            editingHeadcountId === reservation.id
              ? headcountDraft
              : reservation.guest_count,
          );
          const headcountInvalid =
            Number.isNaN(currentHeadcountValue) ||
            currentHeadcountValue < 1 ||
            Boolean(
              reservation.area.capacity &&
              currentHeadcountValue > reservation.area.capacity,
            );
          const linkActionsEnabled =
            canCreateReservation &&
            reservation.status === "CONFIRMED";

          return (
            <motion.div
              key={`mine-${reservation.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 + index * 0.03 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {reservation.event_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reservation.area.name} ·{" "}
                    {formatReservationDate(reservation.reserved_from)} até{" "}
                    {formatReservationDate(reservation.reserved_until)}
                  </p>
                  {reservation.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {reservation.notes}
                    </p>
                  ) : null}
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="rounded-[18px] bg-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    <span>{reservation.guest_count} pessoa(s)</span>
                  </div>
                </div>
                <div className="rounded-[18px] bg-muted px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>{status.helper}</span>
                  </div>
                </div>
              </div>

              {isDuringEvent ? (
                <div className="mt-4 rounded-[20px] border border-border bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Ajustar lotação agora
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={reservation.area.capacity ?? undefined}
                      value={
                        editingHeadcountId === reservation.id
                          ? headcountDraft
                          : reservation.guest_count
                      }
                      onChange={(event) => {
                        setEditingHeadcountId(reservation.id);
                        setHeadcountDraft(event.target.value);
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={
                        updateHeadcountMutation.isPending || headcountInvalid
                      }
                      onClick={() =>
                        updateHeadcountMutation.mutate({
                          reservationId: reservation.id,
                          guest_count: Number(headcountDraft),
                        })
                      }
                    >
                      Atualizar
                    </Button>
                  </div>
                  {reservation.area.capacity &&
                  currentHeadcountValue > reservation.area.capacity ? (
                    <p className="mt-2 text-xs text-destructive">
                      Esta área suporta no máximo {reservation.area.capacity}{" "}
                      pessoa(s).
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between rounded-[18px] bg-muted px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Link dos convidados
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {reservation.status === "CONFIRMED"
                        ? reservation.public_link
                          ? reservation.public_link.replace(/^https?:\/\//, "")
                          : "Toque em compartilhar para gerar ou renovar o link."
                        : "Disponível somente após aprovação da reserva."}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={
                      rotateReservationLinkMutation.isPending ||
                      !linkActionsEnabled
                    }
                    onClick={() => handleShareLink(reservation)}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={
                      rotateReservationLinkMutation.isPending ||
                      !linkActionsEnabled
                    }
                    onClick={() => handleCopyLink(reservation)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={
                      rotateReservationLinkMutation.isPending ||
                      !linkActionsEnabled
                    }
                    onClick={() =>
                      rotateReservationLinkMutation.mutate(reservation.id)
                    }
                  >
                    {rotateReservationLinkMutation.isPending ? (
                      <Clock3 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {myReservations.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma reserva encontrada para este morador.
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default CommonAreasPage;
