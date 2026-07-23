# Google Drive setup

HVAC Plan Studio uses Google Identity Services, Google Picker, and the Google Drive API. Tokens remain in browser memory and are never committed to GitHub.

## Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable **Google Drive API** and **Google Picker API**.
3. Configure the OAuth consent screen.
4. Create an **OAuth client ID** for a Web application.
5. Add the local development origin: `http://localhost:5173`.
6. Add the future production website origin when it is available.
7. Create an API key and restrict it to the Picker and Drive APIs plus the approved website origins.
8. Copy `.env.example` to `.env.local` and enter the Client ID and API key.

The application requests the limited `drive.file` scope. This allows it to open files the user selects and manage files it creates without granting unrestricted access to every Drive file.

Never commit `.env.local`, access tokens, client secrets, or service-account credentials.
