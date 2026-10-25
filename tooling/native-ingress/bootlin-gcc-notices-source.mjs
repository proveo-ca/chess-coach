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
  base: { bytes: 20438, sha256: 'ece2c9edbb3068bc65ce78454b7f8dbc5236d36f046849f4f30085c58c567557' },
  profile: { bytes: 20438, sha256: '92c9251709b15921cfb721994d3c4347d5cd569c27781418f05ab4c88142035e' },
  urls: { bytes: 20778, sha256: 'd202328546dec1a7a10bd92c1f882f9ebb0c7f5c640ccbf185d0971bce644bf5' },
  roles: { bytes: 20907, sha256: '240c6fb0f6c8eec76eb3ea06530e5d40364ceb415192d6650cbb54086bd82a15' },
  requests: { bytes: 20907, sha256: 'a353648bdcdb997e982a67129179157e737a7d24b385666cd1693a43ce2b1d9b' },
  scope: { bytes: 20904, sha256: '702fe9b41085f421dbfd349ca1ee147c1672eada3c34e263c153456e0e51e52a' },
  entryNames: { bytes: 20902, sha256: '6b5a2e0d903d1209ef3bae1dc2a7f3a486d4ab61c5ce568e97000ccba88eab94' },
  policyNames: { bytes: 20888, sha256: '37a06a8641d758908754d76785994ff013e0a468aa9bd123ccaf764ad6909096' },
  media: { bytes: 21026, sha256: '34dbf69a452284c0910b7d5206ee1ec874cea0180f035b5a3349f1a89fc67d3f' },
  headerCharset: { bytes: 21037, sha256: '58646c210a4490236a69e773b074ba75932c697e4f1a72d321ed673202d258f2' },
  nonempty: { bytes: 21071, sha256: '0bc1fcadbcae2b7c7fb11cfb8de1bba3389d05a69153d48ed4d165da48158672' },
  asciiBody: { bytes: 21150, sha256: '1e5d5e84c8c80e1322d0e4941e4ff14af1b7dfadfb76d7a71c4167c3f7137c62' },
  bodyControls: { bytes: 21146, sha256: '022e120ab83f35c7ba626906e3b95c0ef972de6c120a05b668d49db3ee41230d' },
  bodyKind: { bytes: 21147, sha256: 'a9dd1735765158c2877191265f82531af829156d7e1eb7a9ed3f3e177c4f9738' },
  requestsBody: { bytes: 21225, sha256: '14ca9a99cf0acaf481ee83bc424b3c93a93fb0538aeff96eeecfc6ff0f7d71fb' },
  status: { bytes: 21227, sha256: 'ab907eccc60c8f58c351ca82b449d2fd774c96e343e07cf49ceda74b86e77a44' },
});
const policyPin = freeze({ bytes: 1468, sha256: '5c6998988e94606c75ec2be7f18f513e4e1520d2f2b53ad0bfd3a7373bc5f7df' });

export const BOOTLIN_GCC_NOTICES_SOURCE_V1_PINS = freeze({ ...graphPins, policy: policyPin });

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

export function buildBootlinGccNoticesSource(baseV2Source) {
  if (arguments.length !== 1) fail('E_ARGUMENTS');
  if (typeof baseV2Source !== 'string' || baseV2Source.length !== graphPins.base.bytes) fail('E_SOURCE');
  if (/[^\x00-\x7f]/u.test(baseV2Source)) fail('E_SOURCE');
  verify(baseV2Source, graphPins.base);
  let source = baseV2Source;
  source = replace(source, "const PROFILE = 'registered-bootlin-directories-v2';", "const PROFILE = 'registered-bootlin-gcc-notices-v1';", 1, graphPins.profile);
  source = replace(source, "  urls: [\n    'https://toolchains.bootlin.com/downloads/releases/sources/',\n    'https://toolchains.bootlin.com/downloads/releases/licenses/',\n  ],", "  urls: [\n    'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING',\n    'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING.LIB',\n    'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING.RUNTIME',\n    'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING3',\n    'https://toolchains.bootlin.com/downloads/releases/licenses/gcc-final-15.3.0/COPYING3.LIB',\n  ],", 1, graphPins.urls);
  source = replace(source, "  roles: ['sources', 'licenses'],", "  roles: ['copying', 'copying-lib', 'runtime-exception', 'copying3', 'copying3-lib'],\n  bodyFormat: 'LICENSE_NOTICE_TEXT',\n  allowedBodyControls: [9, 10, 12, 13],", 1, graphPins.roles);
  source = replace(source, 'requests: 2, headerPairs: 64, headerBytes: 16384,', 'requests: 5, headerPairs: 64, headerBytes: 16384,', 1, graphPins.requests);
  source = replace(source, "scope: 'ordinary-necessary-toolchain-preparation-directory-metadata',", "scope: 'ordinary-necessary-toolchain-preparation-license-notices',", 1, graphPins.scope);
  source = replace(source, 'collectRegisteredBootlinDirectoriesV2', 'collectRegisteredBootlinGccNoticesV1', 2, graphPins.entryNames);
  source = replace(source, 'BOOTLIN_DIRECTORY_METADATA_V2_PROFILE', 'BOOTLIN_GCC_NOTICES_V1_PROFILE', 2, graphPins.policyNames);
  source = replace(source, String.raw`  check(/^text\/html(?: *; *charset *= *(?:utf-8|utf8))?$/i.test(selected.get('content-type') ?? ''), 'E_HEADERS');`, String.raw`  const media = selected.get('content-type') ?? '';
  check(/^(?:text\/plain(?: *; *charset *= *(?:utf-8|utf8|us-ascii))?|application\/octet-stream)$/i.test(media), 'E_HEADERS');
  const asciiOnly = /^text\/plain *; *charset *= *us-ascii$/i.test(media);`, 1, graphPins.media);
  source = replace(source, '  return { pairs, length };', '  return { pairs, length, asciiOnly };', 1, graphPins.headerCharset);
  source = replace(source, "      check(metadata.length === null || metadata.length === bytes, 'E_BODY');", "      check(bytes > 0, 'E_BODY');\n      check(metadata.length === null || metadata.length === bytes, 'E_BODY');", 1, graphPins.nonempty);
  source = replace(source, '      const body = Buffer.concat(chunks, bytes);\n      let text;', "      const body = Buffer.concat(chunks, bytes);\n      if (metadata.asciiOnly && body.some(byte => byte > 127)) fail('E_UTF8');\n      let text;", 1, graphPins.asciiBody);
  source = replace(source, String.raw`      check(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(text), 'E_UTF8');`, String.raw`      check(!/[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]/u.test(text), 'E_UTF8');`, 1, graphPins.bodyControls);
  source = replace(source, "sourceKind: 'PUBLIC_DIRECTORY_METADATA'", "sourceKind: 'PUBLIC_LICENSE_NOTICE_TEXT'", 1, graphPins.bodyKind);
  source = replace(source, '      await directory(0);\n      await directory(1);', '      await directory(0);\n      await directory(1);\n      await directory(2);\n      await directory(3);\n      await directory(4);', 1, graphPins.requestsBody);
  source = replace(source, "status: 'BOOTLIN_DIRECTORY_METADATA'", "status: 'BOOTLIN_LICENSE_NOTICES_DATA'", 1, graphPins.status);
  verify(source, graphPins.status);
  return freeze({ profile: 'BOOTLIN_GCC_NOTICES_SOURCE_V1', sourceText: source, graphPins, policyPin });
}
