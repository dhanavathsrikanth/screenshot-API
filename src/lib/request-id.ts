import { nanoid } from "nanoid";

export function newRequestId(): string {
  return `req_${nanoid(21)}`;
}
