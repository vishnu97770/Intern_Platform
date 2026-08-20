import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import {
  updateProfileSchema,
  addSkillSchema,
  projectSchema,
  experienceSchema,
  certificationSchema,
} from "./profile.validators.js";
import {
  getProfileHandler,
  updateProfileHandler,
  addSkillHandler,
  removeSkillHandler,
  addProjectHandler,
  deleteProjectHandler,
  addExperienceHandler,
  deleteExperienceHandler,
  addCertificationHandler,
  deleteCertificationHandler,
} from "./profile.controller.js";

export const profileRouter = Router();

profileRouter.use(authenticate);

profileRouter.get("/", getProfileHandler);
profileRouter.patch("/", validateBody(updateProfileSchema), updateProfileHandler);

profileRouter.post("/skills", validateBody(addSkillSchema), addSkillHandler);
profileRouter.delete("/skills/:skillId", removeSkillHandler);

profileRouter.post("/projects", validateBody(projectSchema), addProjectHandler);
profileRouter.delete("/projects/:projectId", deleteProjectHandler);

profileRouter.post("/experience", validateBody(experienceSchema), addExperienceHandler);
profileRouter.delete("/experience/:experienceId", deleteExperienceHandler);

profileRouter.post("/certifications", validateBody(certificationSchema), addCertificationHandler);
profileRouter.delete("/certifications/:certificationId", deleteCertificationHandler);
