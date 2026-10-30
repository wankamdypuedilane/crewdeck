export type DocumentItem = {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
  uploader: string; // full name, for display
};

/** A document as the list shows it, with what the current user may do. */
export type DocumentRow = DocumentItem & { canDelete: boolean };
