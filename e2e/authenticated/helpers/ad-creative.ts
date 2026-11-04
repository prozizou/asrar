// A local fixture only: never load a real advertiser during tests.
export async function mockActionCreative(page: any) {
  await page.route('https://bicea.org/22/**', (route: any) => route.fulfill({ contentType: 'application/javascript', body: `{
    const frame = document.createElement('iframe'); frame.width = '300'; frame.height = '250';
    frame.src = 'https://bicea.org/asrar-test-creative'; document.currentScript.parentElement.append(frame);
  }` }));
  await page.route('https://bicea.org/asrar-test-creative', (route: any) => route.fulfill({ contentType: 'text/html', body: '<html><body style="background:#654394;color:white">Publicité de test locale</body></html>' }));
}
