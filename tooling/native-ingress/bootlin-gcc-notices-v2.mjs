// SPEC: _spec/tooling/native-ingress/step2.puml
import { createHash } from 'node:crypto';

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const graphPins = freeze({
  base: { bytes: 21227, sha256: 'ab907eccc60c8f58c351ca82b449d2fd774c96e343e07cf49ceda74b86e77a44' },
  profile: { bytes: 21227, sha256: '222c7415fe8e2e225195423fc4bfa5970a0d32a4d9834eadd046b8d0494cb48d' },
  entryNames: { bytes: 21227, sha256: 'b462226f68d322e7018724066f440e25e45595ff7dd19ca677dfdcd81cae33e2' },
  policyNames: { bytes: 21227, sha256: '73bd42d3a8abaa7cc12362cd2fe97e2e9a017c9b2f95d877843b9af696d9d4ac' },
  absentPolicy: { bytes: 21255, sha256: 'e14883d54334242f8d5c15afe11a05315d90bb9cc3e20daf04f4384055488ebc' },
  declaration: { bytes: 21336, sha256: '4eb87061dd2d5756a242696eac537aab5f7c4ab74f830b3cc0636afd61918456' },
  acceptance: { bytes: 21354, sha256: 'dadbf9b890863e23086ee4138d29bb15eeb63841f7ab113a44372d10ea6aa1c5' },
  headerRecord: { bytes: 21402, sha256: '78746045d9d2ae92ef4b128eb7b1cb6a835749946e95e16d5e85901f14125a45' },
  observation: { bytes: 21510, sha256: '6b0dbb219859300b7c5530d314f6d6fa1a6d1ff1146400af92ed707134239866' },
});
const policyPin = freeze({ bytes: 1494, sha256: '227acf8ed390f17ccece2691fd11e8d05d5d589a59878b67925bd0e2a0275abd' });

export const BOOTLIN_GCC_NOTICES_V2_PINS = freeze({ ...graphPins, policy: policyPin });

function fail(code) { throw new Error(code); }

function verify(source, pin) {
  if (source.length !== pin.bytes || createHash('sha256').update(source, 'ascii').digest('hex') !== pin.sha256) fail('E_PIN');
}

function replace(source, oldText, newText, count, pin) {
  const parts = source.split(oldText);
  if (parts.length !== count + 1) fail('E_TRANSFORM');
  const result = parts.join(newText);
  verify(result, pin);
  return result;
}

export function buildBootlinGccNoticesV2Source(baseNoticeV1Source) {
  if (arguments.length !== 1) fail('E_ARGUMENTS');
  if (typeof baseNoticeV1Source !== 'string' || baseNoticeV1Source.length !== graphPins.base.bytes) fail('E_SOURCE');
  if (/[^\x00-\x7f]/u.test(baseNoticeV1Source)) fail('E_SOURCE');
  verify(baseNoticeV1Source, graphPins.base);
  let source = baseNoticeV1Source;
  source = replace(source, "const PROFILE = 'registered-bootlin-gcc-notices-v1';", "const PROFILE = 'registered-bootlin-gcc-notices-v2';", 1, graphPins.profile);
  source = replace(source, 'collectRegisteredBootlinGccNoticesV1', 'collectRegisteredBootlinGccNoticesV2', 2, graphPins.entryNames);
  source = replace(source, 'BOOTLIN_GCC_NOTICES_V1_PROFILE', 'BOOTLIN_GCC_NOTICES_V2_PROFILE', 2, graphPins.policyNames);
  source = replace(source, "  bodyFormat: 'LICENSE_NOTICE_TEXT',\n  allowedBodyControls: [9, 10, 12, 13],", "  bodyFormat: 'LICENSE_NOTICE_TEXT',\n  absentMediaAllowed: true,\n  allowedBodyControls: [9, 10, 12, 13],", 1, graphPins.absentPolicy);
  source = replace(source, "  const media = selected.get('content-type') ?? '';", "  const contentTypeExposed = selected.has('content-type');\n  const media = contentTypeExposed ? selected.get('content-type') : null;", 1, graphPins.declaration);
  source = replace(source, String.raw`  check(/^(?:text\/plain(?: *; *charset *= *(?:utf-8|utf8|us-ascii))?|application\/octet-stream)$/i.test(media), 'E_HEADERS');`, String.raw`  check(media === null || /^(?:text\/plain(?: *; *charset *= *(?:utf-8|utf8|us-ascii))?|application\/octet-stream)$/i.test(media), 'E_HEADERS');`, 1, graphPins.acceptance);
  source = replace(source, '  return { pairs, length, asciiOnly };', '  return { pairs, length, asciiOnly, contentTypeExposed, declaredContentType: media };', 1, graphPins.headerRecord);
  source = replace(source, '        exposedHeaders: metadata.pairs, observedBodyBytes: bytes, bodySha256, bodyUtf8: text,', '        exposedHeaders: metadata.pairs, observedBodyBytes: bytes, bodySha256, bodyUtf8: text,\n        contentTypeExposed: metadata.contentTypeExposed, declaredContentType: metadata.declaredContentType,', 1, graphPins.observation);
  verify(source, graphPins.observation);
  return freeze({ profile: 'BOOTLIN_GCC_NOTICES_V2_SOURCE', sourceText: source, graphPins, policyPin });
}
