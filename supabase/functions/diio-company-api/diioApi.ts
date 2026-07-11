import { firstString } from "./mapping.ts";

type DiioApiResponse = {
  ok: boolean;
  status: number;
  raw: string;
  parsed: Record<string, unknown> | null;
};

async function readApiResponse(response: Response): Promise<DiioApiResponse> {
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed,
  };
}

export async function refreshAccessToken({
  companyUrl,
  clientId,
  clientSecret,
  refreshToken,
}: {
  companyUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const response = await fetch(`${companyUrl}/api/external/refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const result = await readApiResponse(response);
  const accessToken = firstString(result.parsed?.access_token);
  return {
    ...result,
    ok: result.ok && Boolean(accessToken),
    accessToken,
  };
}

export async function listMeetings(companyUrl: string, accessToken: string, page = 1, limit = 10) {
  const response = await fetch(`${companyUrl}/api/external/v1/meetings?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}

export async function listAllMeetings(companyUrl: string, accessToken: string) {
  const allMeetings: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 100;
  const maxPages = 20;
  let lastResponse: DiioApiResponse | null = null;

  while (page <= maxPages) {
    const current = await listMeetings(companyUrl, accessToken, page, limit);
    lastResponse = current;
    if (!current.ok) return { ...current, meetings: allMeetings };
    const currentMeetings = Array.isArray(current.parsed?.meetings) ? current.parsed.meetings as Record<string, unknown>[] : [];
    allMeetings.push(...currentMeetings);
    const nextPage = Number(current.parsed?.next || 0);
    if (!nextPage || currentMeetings.length < limit) {
      return { ...current, meetings: allMeetings };
    }
    page = nextPage;
  }

  return {
    ok: true,
    status: lastResponse?.status || 200,
    raw: lastResponse?.raw || "",
    parsed: lastResponse?.parsed || { meetings: allMeetings },
    meetings: allMeetings,
  };
}

export async function listPhoneCalls(companyUrl: string, accessToken: string, page = 1, limit = 20) {
  const response = await fetch(`${companyUrl}/api/external/v1/phone_calls?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}

export async function listAllPhoneCalls(companyUrl: string, accessToken: string) {
  const allCalls: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 100;
  const maxPages = 20;
  let lastResponse: DiioApiResponse | null = null;

  while (page <= maxPages) {
    const current = await listPhoneCalls(companyUrl, accessToken, page, limit);
    lastResponse = current;
    if (!current.ok) return { ...current, phoneCalls: allCalls };
    const currentCalls = Array.isArray(current.parsed?.phone_calls) ? current.parsed.phone_calls as Record<string, unknown>[] : [];
    allCalls.push(...currentCalls);
    const nextPage = Number(current.parsed?.next || 0);
    if (!nextPage || currentCalls.length < limit) {
      return { ...current, phoneCalls: allCalls };
    }
    page = nextPage;
  }

  return {
    ok: true,
    status: lastResponse?.status || 200,
    raw: lastResponse?.raw || "",
    parsed: lastResponse?.parsed || { phone_calls: allCalls },
    phoneCalls: allCalls,
  };
}

export async function getMeetingDetail(companyUrl: string, accessToken: string, meetingId: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/meetings/${encodeURIComponent(meetingId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}

export async function getPhoneCallDetail(companyUrl: string, accessToken: string, phoneCallId: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/phone_calls/${encodeURIComponent(phoneCallId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}

export async function getTranscriptDetail(companyUrl: string, accessToken: string, transcriptId: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/transcripts/${encodeURIComponent(transcriptId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}

export async function listUsers(companyUrl: string, accessToken: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/users?page=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}

export async function listAllUsers(companyUrl: string, accessToken: string) {
  const allUsers: Record<string, unknown>[] = [];
  let page = 1;
  const maxPages = 20;
  let lastResponse: DiioApiResponse | null = null;

  while (page <= maxPages) {
    const response = await fetch(`${companyUrl}/api/external/v1/users?page=${page}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const current = await readApiResponse(response);
    lastResponse = current;
    if (!current.ok) return { ...current, users: allUsers };
    const currentUsers = Array.isArray(current.parsed?.users) ? current.parsed.users as Record<string, unknown>[] : [];
    allUsers.push(...currentUsers);
    if (currentUsers.length < 10) {
      return { ...current, users: allUsers };
    }
    page += 1;
  }

  return {
    ok: true,
    status: lastResponse?.status || 200,
    raw: lastResponse?.raw || "",
    parsed: lastResponse?.parsed || { users: allUsers },
    users: allUsers,
  };
}

export async function getPlaybookDetail(companyUrl: string, accessToken: string, playbookId: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/playbooks/${encodeURIComponent(playbookId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readApiResponse(response);
}
