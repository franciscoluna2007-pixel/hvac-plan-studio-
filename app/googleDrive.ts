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
        PickerBuilder: new () => {
          addView(view: unknown): unknown;
          setOAuthToken(token: string): unknown;
          setDeveloperKey(key: string): unknown;
          setAppId(appId: string): unknown;
          setCallback(callback: (data: PickerResult) => void): unknown;
          setTitle(title: string): unknown;
          enableFeature(feature: string): unknown;
          build(): { setVisible(value: boolean): void };
        };
        ViewId: { DOCS: string };
      };
    };
    gapi?: {
      load(name: string, callback: () => void): void;
    };
  }
}

type PickerDocument = { id: string; name: string; mimeType: string };
type PickerResult = { action: string; docs?: PickerDocument[] };
type GoogleDriveConfig = { clientId: string; apiKey: string; appId: string };

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
  return new Promise<{ name: string; bytes: Uint8Array }>((resolve, reject) => {
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
          resolve({ name: document.name, bytes: new Uint8Array(await response.arrayBuffer()) });
        } catch (error) {
          reject(error);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

export function isDriveConfigured() {
  return true;
}
