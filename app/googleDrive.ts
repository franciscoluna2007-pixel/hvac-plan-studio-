type PickerDocument = { id: string; name: string; mimeType: string; url?: string };
type PickerResult = { action: string; docs?: PickerDocument[] };
type GooglePickerBuilder = {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  setCallback(callback: (data: PickerResult) => void): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  enableFeature(feature: string): GooglePickerBuilder;
  build(): { setVisible(value: boolean): void };
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken(): void };
        };
      };
      picker: {
        Action: { PICKED: string };
        DocsView: new (viewId: string) => {
          setMimeTypes(types: string): unknown;
          setIncludeFolders(value: boolean): unknown;
          setSelectFolderEnabled(value: boolean): unknown;
        };
        DocsViewMode: { LIST: string };
        Feature: { NAV_HIDDEN: string };
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS: string };
      };
    };
    gapi?: {
      load(name: string, callback: () => void): void;
    };
  }
}

type GoogleDriveConfig = { clientId: string; apiKey: string; appId: string };
export type DrivePdf = { id: string; name: string; bytes: Uint8Array; webViewLink?: string };
export type DriveProjectPackage = { id: string; name: string; webViewLink: string; updated: boolean };

let accessToken = "";
let configuration: GoogleDriveConfig | null = null;

async function getConfiguration() {
  if (configuration) return configuration;
  const response = await fetch("/api/google-config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Google Drive setup is incomplete. Contact the HVAC Plan Studio administrator.");
  }
  const value = await response.json() as Partial<GoogleDriveConfig>;
  if (!value.clientId || !value.apiKey || !value.appId) {
    throw new Error("Google Drive setup is incomplete. Contact the HVAC Plan Studio administrator.");
  }
  configuration = value as GoogleDriveConfig;
  return configuration;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Drive could not be loaded.")), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

async function loadGoogleApis() {
  const config = await getConfiguration();
  await Promise.all([
    loadScript("https://accounts.google.com/gsi/client"),
    loadScript("https://apis.google.com/js/api.js"),
  ]);
  await new Promise<void>((resolve) => window.gapi!.load("picker", resolve));
  return config;
}

async function authorize() {
  const config = await loadGoogleApis();
  if (accessToken) return { token: accessToken, config };
  const token = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (!response.access_token) return reject(new Error(response.error || "Google Drive access was not approved."));
        accessToken = response.access_token;
        resolve(accessToken);
      },
    });
    client.requestAccessToken();
  });
  return { token, config };
}

export async function pickPdfFromDrive() {
  const { token, config } = await authorize();
  return new Promise<DrivePdf>((resolve, reject) => {
    const view = new window.google!.picker.DocsView(window.google!.picker.ViewId.DOCS);
    view.setMimeTypes("application/pdf");
    const picker = new window.google!.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setTitle("Choose a construction PDF")
      .setCallback(async (data) => {
        if (data.action !== window.google!.picker.Action.PICKED || !data.docs?.[0]) return;
        try {
          const document = data.docs[0];
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${document.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error("The selected PDF could not be downloaded.");
          resolve({
            id: document.id,
            name: document.name,
            bytes: new Uint8Array(await response.arrayBuffer()),
            webViewLink: document.url,
          });
        } catch (error) {
          reject(error);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

export async function loadPdfFromDriveId(fileId: string, name = "Cloud project source.pdf") {
  const { token } = await authorize();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("The linked source PDF could not be downloaded from Google Drive.");
  return {
    id: fileId,
    name,
    bytes: new Uint8Array(await response.arrayBuffer()),
  } satisfies DrivePdf;
}

function safeDriveFileName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return `${cleaned || "HVAC Plan Studio"}.hvacplan.json`;
}

export async function saveProjectPackageToDrive(payload: Record<string, unknown>, existingFileId?: string | null) {
  const { token } = await authorize();
  const body = JSON.stringify(payload, null, 2);
  const projectName = typeof payload.projectName === "string" ? payload.projectName : "HVAC Plan Studio";
  const metadata = {
    name: safeDriveFileName(projectName),
    mimeType: "application/json",
    description: "HVAC Plan Studio cloud project package",
  };

  let response: Response;
  if (existingFileId) {
    response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media&fields=id,name,webViewLink`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
  } else {
    const boundary = `hvac_plan_studio_${Date.now()}`;
    const multipart = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n`,
      `--${boundary}--`,
    ].join("");
    response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });
  }

  if (!response.ok) throw new Error("The project package could not be saved to Google Drive.");
  const result = await response.json() as { id: string; name: string; webViewLink?: string };
  return {
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink || `https://drive.google.com/open?id=${result.id}`,
    updated: Boolean(existingFileId),
  } satisfies DriveProjectPackage;
}

export function isDriveConfigured() {
  return true;
}
