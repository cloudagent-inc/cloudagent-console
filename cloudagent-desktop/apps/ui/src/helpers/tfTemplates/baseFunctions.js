export function mergeTfTemplates(tfTemplate1, tfTemplate2) {
  if (tfTemplate1 === null) tfTemplate1 = '';
  if (tfTemplate2 === null) tfTemplate2 = '';
  let newTemplate =
    tfTemplate1.length === 0 ? tfTemplate2 : tfTemplate1 + '\n\n' + tfTemplate2;

  if (newTemplate.indexOf('data "aws_caller_identity" "current" {}') > -1) {
    //replace call to get account identity if foudn in multiple variables
    newTemplate =
      'data "aws_caller_identity" "current" {}' +
      '\n' +
      newTemplate.replace(/data "aws_caller_identity" "current" {}/g, '');
  }

  if (newTemplate.indexOf('data "aws_region" "current" {}') > -1) {
    //replace call to get account identity if foudn in multiple variables
    newTemplate =
      'data "aws_region" "current" {}' +
      '\n' +
      newTemplate.replace(/data "aws_region" "current" {}/g, '');
  }

  return newTemplate;
}

export function tfGetReturnFromResource(
  resourceType,
  resourceLabel,
  output,
  tfVersion = 'v0.12'
) {
  if (tfVersion === 'v0.11')
    return '"${' + resourceType + '.' + resourceLabel + '.' + output + '}"';
  else return resourceType + '.' + resourceLabel + '.' + output;
}

export function addComment(text) {
  return `\n/* ${text} */`;
}
export function stringDoubleQuotes(text) {
  return '"' + text + '"';
}

export function stringBrackets(text) {
  return '[' + text + ']';
}

export function getValueFromResourceImport(value) {
  return value['tf'];
}

export function tfResourceTemplate(
  resourceType,
  resourceLabel,
  properties,
  inlineAdditionalProperties = ''
) {
  var tfTemplate = '';

  tfTemplate += `resource ${stringDoubleQuotes(
    resourceType
  )} ${stringDoubleQuotes(resourceLabel)} {\n`;

  Object.keys(properties).map((property) => {
    const key = property;
    const value = properties[key];

    tfTemplate += `  ${key} = ${value}` + '\n';
  });

  if (inlineAdditionalProperties.length > 0)
    tfTemplate += '\n' + inlineAdditionalProperties;

  tfTemplate += '}';

  return tfTemplate;
}
