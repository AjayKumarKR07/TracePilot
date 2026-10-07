import type { NotificationType } from '../types/notification';

export interface NotificationNavTarget {
  id?: number | string;
  notification_type?: NotificationType | string;
  title?: string;
  message?: string;
  entity_type?: string | null;
  entity_id?: number | null;
  entity_key?: string | null;
  destination?: string | null;
  context?: string | null;
}

/**
 * Centralized Notification-to-Route Resolver
 *
 * Implements strict role-based routing and deep linking across TracePilot:
 * 1. Developer sprint notifications -> /developer-sprints (?sprintId=ID)
 * 2. Admin sprint approval / submission / review notifications â†’ /admin/sprint-approvals (?sprintId=ID)
 * 3. Admin sprint management notifications â†’ /admin/sprints (?sprintId=ID)
 * 4. Issue assignment / reported notifications â†’ /issues?issueId=ID (open/focus issue)
 * 5. Comment / attachment / issue update notifications â†’ /issues/:id (related issue details)
 * 6. User management notifications â†’ /admin (for Admin) or /profile (for user)
 * 7. Safe fallback to appropriate role dashboard when no valid target exists
 */
export function getNotificationDestination(
  notif: NotificationNavTarget,
  userRole?: string
): string {
  const role = (userRole || 'USER').toUpperCase();
  const type = (notif.notification_type || '').toString();
  const entityType = (notif.entity_type || notif.context || '').toUpperCase();
  const entityId = notif.entity_id;
  const title = (notif.title || '').toLowerCase();
  const msg = (notif.message || '').toLowerCase();

  // Helper to append entity ID query param if available
  const withQueryParam = (base: string, paramName: string, id: number | null | undefined): string => {
    if (id !== null && id !== undefined && !isNaN(Number(id))) {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}${paramName}=${id}`;
    }
    return base;
  };

  // 1. Detect if notification is sprint- or approval-related
  const isSprintEntity = entityType === 'SPRINT';
  const isSprintType =
    type === 'SPRINT_STARTED' ||
    type === 'SPRINT_ENDED' ||
    type === 'SPRINT_OVERDUE';
  const isSprintText = title.includes('sprint') || msg.includes('sprint');
  const isSprintRelated = isSprintEntity || isSprintType || isSprintText;

  const isApprovalText =
    title.includes('approval') ||
    title.includes('awaiting') ||
    title.includes('submitted for approval') ||
    title.includes('request changes') ||
    title.includes('changes requested') ||
    title.includes('approved') ||
    (msg.includes('submitted') && msg.includes('approval')) ||
    msg.includes('changes requested');

  // Rule 2 & 5: Sprint & Approval notifications
  if (isSprintRelated || isApprovalText) {
    // DEVELOPER:
    if (role === 'DEVELOPER') {
      return withQueryParam('/developer-sprints', 'sprintId', entityId);
    }

    // ADMIN:
    if (role === 'ADMIN') {
      // Approval / Submission / Review notifications
      if (
        isApprovalText &&
        (title.includes('submitted') ||
          title.includes('awaiting') ||
          title.includes('approval') ||
          title.includes('changes'))
      ) {
        return withQueryParam('/admin/sprint-approvals', 'sprintId', entityId);
      }
      // General sprint management notifications (assigned, started, completed)
      return withQueryParam('/admin/sprints', 'sprintId', entityId);
    }

    // Regular USER cannot access admin or developer sprint centers
    return '/dashboard';
  }

  // Rule 4: Comment / Attachment / Issue status updates â†’ navigate directly to the related issue
  const isCommentOrAttachmentOrStatusUpdate =
    type === 'ISSUE_COMMENTED' ||
    type === 'ISSUE_MENTIONED' ||
    type === 'ATTACHMENT_ADDED' ||
    type === 'ISSUE_STATUS_CHANGED' ||
    type === 'ISSUE_RESOLVED' ||
    type === 'ISSUE_REOPENED' ||
    title.includes('comment') ||
    title.includes('attachment') ||
    title.includes('status changed') ||
    title.includes('resolved') ||
    title.includes('reopened');

  if (isCommentOrAttachmentOrStatusUpdate) {
    if (entityId) {
      return `/issues/${entityId}`;
    }
    return '/issues';
  }

  // Rule 3: Issue notifications (e.g. ISSUE_ASSIGNED, ISSUE_REPORTED) â†’ navigate to /issues and focus specific issue
  const isIssueRelated =
    entityType === 'ISSUE' ||
    type === 'ISSUE_ASSIGNED' ||
    type === 'ISSUE_REPORTED' ||
    title.includes('issue') ||
    title.includes('defect');

  if (isIssueRelated) {
    if (entityId) {
      return withQueryParam('/issues', 'issueId', entityId);
    }
    return '/issues';
  }

  // Rule 6 & 7: User role / status management notifications
  if (
    entityType === 'USER' ||
    type === 'USER_ROLE_CHANGED' ||
    type === 'USER_ACTIVATED' ||
    type === 'USER_DEACTIVATED' ||
    title.includes('role') ||
    title.includes('account')
  ) {
    if (role === 'ADMIN') {
      return '/admin';
    }
    return '/profile';
  }

  // Check if explicit destination is supplied in payload and conforms to RBAC
  if (notif.destination && typeof notif.destination === 'string') {
    const dest = notif.destination.trim();
    if (dest.startsWith('/admin') && role !== 'ADMIN') {
      // Forbidden for non-admin
    } else if (dest.startsWith('/developer') && role !== 'DEVELOPER') {
      // Forbidden for non-developer
    } else {
      return dest;
    }
  }

  // Rule 12: Safe fallback to appropriate dashboard per role
  if (role === 'ADMIN') return '/admin-dashboard';
  if (role === 'DEVELOPER') return '/developer-dashboard';
  return '/dashboard';
}

