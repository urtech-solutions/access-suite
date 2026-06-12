import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestAccessOsForgotPassword,
  registerAccessOsAccount,
  resetAccessOsPassword,
  requestAccessOsRegisterCode,
  validateAccessOsResetCode,
} from "@/services/mobile-app.service";

describe("AccessOS registration email verification", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("requests a verification code before registration", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({ success: true, expires_in_minutes: 10 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAccessOsRegisterCode(
      "maria@example.com",
      "http://localhost:3000",
    );

    expect(result).toEqual({ success: true, expires_in_minutes: 10 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/register/request-code",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "maria@example.com" }),
      }),
    );
  });

  it("sends the verification code when creating the AccessOS account", async () => {
    const response = {
      access_token: "access-token",
      refresh_token: null,
      user: { uuid: "acc-1", name: "Maria", modules: [] },
      account_uuid: "acc-1",
      cpf_digits: "",
      profile_type: "RESIDENT",
      contexts: [],
      active_context: null,
      requires_context_selection: false,
      current_session: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => response,
    });
    vi.stubGlobal("fetch", fetchMock);

    await registerAccessOsAccount(
      {
        email: "maria@example.com",
        cpf: "52998224725",
        email_verification_code: "123456",
        name: "Maria",
        password: "minhaSenha123",
        phone_number: "+55 11 99999-9999",
      },
      "http://localhost:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "maria@example.com",
          cpf: "52998224725",
          email_verification_code: "123456",
          name: "Maria",
          password: "minhaSenha123",
          phone_number: "+55 11 99999-9999",
        }),
      }),
    );
  });

  it("requests a password recovery code for AccessOS", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({
        message:
          "Se o e-mail informado estiver cadastrado, enviaremos um codigo de recuperacao.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAccessOsForgotPassword(
      "maria@example.com",
      "http://localhost:3000",
    );

    expect(result.message).toContain("codigo de recuperacao");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/forgot-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "maria@example.com" }),
      }),
    );
  });

  it("redefines the AccessOS password with e-mail, code and new password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({
        message: "Senha redefinida com sucesso. Faca login com sua nova senha.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await resetAccessOsPassword(
      {
        code: "123456",
        confirm_password: "NovaSenha123",
        email: "maria@example.com",
        new_password: "NovaSenha123",
      },
      "http://localhost:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "123456",
          confirm_password: "NovaSenha123",
          email: "maria@example.com",
          new_password: "NovaSenha123",
        }),
      }),
    );
  });

  it("validates the AccessOS recovery code before showing the password form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({
        message: "Codigo validado com sucesso.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await validateAccessOsResetCode(
      {
        code: "123456",
        email: "maria@example.com",
      },
      "http://localhost:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/validate-reset-code",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "123456",
          email: "maria@example.com",
        }),
      }),
    );
  });
});
