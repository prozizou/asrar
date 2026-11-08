import base from './playwright.auth.config';
export default { ...base, globalTimeout: 1200000, projects: [{ ...base.projects![0], use: { ...base.projects![0].use, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } }] };
