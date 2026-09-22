const STATUS_META = {
  pending: { label: 'รอตรวจสอบ', badgeClass: 'badge-pending' },
  in_progress: { label: 'กำลังดำเนินการ', badgeClass: 'badge-in-progress' },
  resolved: { label: 'แก้ไขแล้ว', badgeClass: 'badge-resolved' },
};

export function statusLabel(status) {
  return (STATUS_META[status] || STATUS_META.pending).label;
}

export function statusBadgeClass(status) {
  return (STATUS_META[status] || STATUS_META.pending).badgeClass;
}

export function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
