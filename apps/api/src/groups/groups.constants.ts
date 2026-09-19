/** Group match: 2..5 members (creator + 1..4 invitees), per plan.md. */
export const MAX_GROUP_SIZE = 5;
export const MIN_GROUP_INVITEES = 1;

/** Real-time event names broadcast on the chat namespace. */
export const GROUP_MESSAGE_EVENT = 'group:message:new';
export const GROUP_INVITE_EVENT = 'group:invite';
export const GROUP_RESPONSE_EVENT = 'group:response';
