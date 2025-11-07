export type NoticeTone = "default" | "info" | "success" | "warning" | "error";

export interface NoticeOptions {
  tone?: NoticeTone;
  persistent?: boolean;
}

