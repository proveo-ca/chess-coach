// SPEC: _spec/gpu-input-transfer.puml
import request from "./identity-publication-request.json";
import { publishPreparedHttps } from "./publish-https";

if (import.meta.main) {
  if (request.privateGitIdentityPreflightAuthorized !== true || request.identityValueChangesOrPersistenceAuthorized !== false) throw Error("INHERITED_IDENTITY_SCOPE_REQUIRED");
  await publishPreparedHttps(request);
}
