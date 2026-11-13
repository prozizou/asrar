'use client';
// Client des visioconférences Google Meet — enveloppes autour de /api/visio
// (pages/api/visio.js). La validation partagée vit dans lib/visioLogic.js.
import { apiPost } from './api';

export function listMeetings() {
  return apiPost('visio', { action: 'list' });
}
export function createMeeting({ title, description, meetUrl, startAt, durationMin }) {
  return apiPost('visio', { action: 'create', title, description, meetUrl, startAt, durationMin });
}
export function updateMeeting(meetingId, { title, description, meetUrl, startAt, durationMin }) {
  return apiPost('visio', { action: 'update', meetingId, title, description, meetUrl, startAt, durationMin });
}
export function deleteMeeting(meetingId) {
  return apiPost('visio', { action: 'delete', meetingId });
}
export function approveMeeting(meetingId) {
  return apiPost('visio', { action: 'approve', meetingId });
}
