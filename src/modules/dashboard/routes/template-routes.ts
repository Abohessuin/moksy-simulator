import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { DASHBOARD_API_PREFIX } from "../constants.js";
import { DASHBOARD_MESSAGES } from "../messages.js";

export const AGREEMENT_TEMPLATE_FILENAME = "API_Agreement_Template.docx";
const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Locates the agreement template in source, bundled, CLI, or installed-package layouts.
 *
 * @returns The absolute template path, or `undefined` when no packaged template exists.
 */
function agreementTemplatePath(): string | undefined {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDirectory, "../templates", AGREEMENT_TEMPLATE_FILENAME),
    path.resolve(
      moduleDirectory,
      "../../../../templates",
      AGREEMENT_TEMPLATE_FILENAME,
    ),
    path.resolve(process.cwd(), "templates", AGREEMENT_TEMPLATE_FILENAME),
    path.resolve(
      process.cwd(),
      "node_modules/moksy/templates",
      AGREEMENT_TEMPLATE_FILENAME,
    ),
    path.resolve(
      path.dirname(process.argv[1] ?? ""),
      "../templates",
      AGREEMENT_TEMPLATE_FILENAME,
    ),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

/**
 * Registers the official API agreement template download.
 *
 * @param app - The Fastify server on which the template route is registered.
 */
export function registerTemplateRoutes(app: FastifyInstance): void {
  app.get(
    `${DASHBOARD_API_PREFIX}/agreement-template`,
    async (_request, reply) => {
      const templatePath = agreementTemplatePath();
      if (!templatePath) {
        return reply
          .status(404)
          .send({ message: DASHBOARD_MESSAGES.TEMPLATE_NOT_FOUND });
      }

      return reply
        .header(
          "content-disposition",
          `attachment; filename="${AGREEMENT_TEMPLATE_FILENAME}"`,
        )
        .type(DOCX_CONTENT_TYPE)
        .send(fs.createReadStream(templatePath));
    },
  );
}
