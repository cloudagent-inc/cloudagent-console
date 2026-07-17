import { Router } from "express";
import { validateAwsCredentials } from "../cloud-setup/aws-discovery.mjs";
import { PermissionProfileCreateSchema, PermissionProfilePatchSchema, localAuth, parseBody } from "../../lib/http.mjs";
import { validateStoredPermissionProfiles } from "./permission-profile-service.mjs";

export function createPermissionProfileRouter({ store }) {
  if (!store) throw new Error("createPermissionProfileRouter requires a store");
  const router = Router();

  router.get("/permission-profiles", async (_req, res, next) => {
    try {
      const profiles = await store.listPermissionProfiles();
      res.json({ ok: true, agentPermissionProfiles: profiles, permissionProfiles: profiles, items: profiles });
    } catch (error) {
      next(error);
    }
  });


  router.post("/permission-profiles", async (req, res, next) => {
    const body = parseBody(PermissionProfileCreateSchema, req, res);
    if (!body) return;
    try {
      const profile = await store.createPermissionProfile(body);
      res.status(201).json({ ok: true, profile, item: profile });
    } catch (error) {
      next(error);
    }
  });


  router.post("/permission-profiles/validate-credentials", async (_req, res, next) => {
    try {
      const profiles = await validateStoredPermissionProfiles({ store });
      const invalidProfiles = profiles.filter((profile) => {
        const status = profile?.credentialStatus || null;
        return status?.lastCheckedValid === false || status?.ok === false;
      });
      res.json({
        ok: true,
        agentPermissionProfiles: profiles,
        permissionProfiles: profiles,
        items: profiles,
        invalidCount: invalidProfiles.length,
      });
    } catch (error) {
      next(error);
    }
  });


  router.post("/permission-profiles/:recordId/validate-credentials", async (req, res, next) => {
    try {
      const profile = await store.getPermissionProfile(req.params.recordId);
      if (!profile) return res.status(404).json({ ok: false, error: "Permission profile not found" });
      const [updatedProfile] = await validateStoredPermissionProfiles({ store, recordId: req.params.recordId });
      res.json({
        ok: true,
        profile: updatedProfile,
        item: updatedProfile,
        credentialStatus: updatedProfile?.credentialStatus || null,
      });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/permission-profiles/:recordId", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const profile = await store.updatePermissionProfile(req.params.recordId, body);
      if (!profile) return res.status(404).json({ ok: false, error: "Permission profile not found" });
      res.json({ ok: true, profile, item: profile });
    } catch (error) {
      next(error);
    }
  });


  router.delete("/permission-profiles/:recordId", async (req, res, next) => {
    try {
      const deleted = await store.deletePermissionProfile(req.params.recordId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        recordId: req.params.recordId,
        ...(deleted ? {} : { error: "Permission profile not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createPermissionProfileRootRouter({ store }) {
  if (!store) throw new Error("createPermissionProfileRootRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.post("/validateAwsCredentialsV2", async (req, res) => {
    try {
      const result = await validateAwsCredentials({
        authProfile: req.body?.authProfile || req.body || {},
        region: req.body?.region || req.body?.defaultRegion,
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        code: "ERROR",
        message: error?.message || "Failed to validate AWS credentials.",
      });
    }
  });


  router.post("/validate-creds", async (req, res) => {
    try {
      const result = await validateAwsCredentials({
        authProfile: req.body?.authProfile || req.body || {},
        region: req.body?.region || req.body?.defaultRegion,
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        code: "ERROR",
        message: error?.message || "Failed to validate AWS credentials.",
      });
    }
  });

  return router;
}
