import { Request, Response, NextFunction } from "express";
import { db } from "../db/db";
import { accessLogsTable } from "../db/schema/accessLogs";
import { errorLogsTable } from "../db/schema/errorLogs";
import { CustomError, raiseError } from "../events/notify";
import { getIpAddress, normalizeIpAddress } from "../utils/index";

/**
 * Logs the request details to the access logs table
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @param {NextFunction} next - The next function in the middleware chain
 */
export const loggingMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientIp = normalizeIpAddress(getIpAddress(req))!;
  try {
    console.log(
      "recieved request, endpoint: ",
      req.baseUrl + req.path,
      "query: ",
      req.query,
      "body: ",
      req.body,
      "method: ",
      req.method,
      "clientIp: ",
      clientIp,
      "userAgent: ",
      req.headers["user-agent"]
    );

    // Skip database logging for health endpoint
    if (req.path !== "/health") {
      await db.insert(accessLogsTable).values({
        endpoint: req.baseUrl + req.path,
        queryString: JSON.stringify(req.query),
        body: JSON.stringify(req.body),
        action: req.method as "GET" | "POST" | "DELETE" | "PUT",
        connection: "http",
        clientIp,
        userAgent: req.headers["user-agent"],
      });
    }

    next();
  } catch (err) {
    console.error("Error in logging middleware:", err);
    next(err);
  }
};

/**
 * Handles errors in the middleware chain
 * @param {Error} err - The error object
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @param {NextFunction} next - The next function in the middleware chain
 */
export const errorHandler = async (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err.stack);

  let statusCode = 500;
  let message = "Internal server error";

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  await db.insert(errorLogsTable).values({
    endpoint: req.baseUrl + req.path,
    errorTrace: err.stack + "\n" + err.message + "\n" + String(err),
    level: "warning",
  });
  res.status(statusCode).send({ status: "error", message });
};
