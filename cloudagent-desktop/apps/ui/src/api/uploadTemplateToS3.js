export async function uploadTemplateToS3(fileContent) {
  let templateUrl = '';
  const functionUrl =
    'https://wmhbd62pw5fhummwy6emc235ve0mbbkk.lambda-url.us-east-1.on.aws/';

  await fetch(functionUrl, {
    method: 'POST',
    headers: {
      // 'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template: fileContent,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      templateUrl = data['url'];
      return data['url'];
    })
    .catch((error) => {
      console.error('uploadTemplateToS3 error:', error);
      return '';
    });

  return templateUrl;
}
