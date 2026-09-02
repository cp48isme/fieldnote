"use client";

/**
 * A terminal state: something is wrong, capture cannot proceed, and here is what to do.
 *
 * There is deliberately no dismiss control. Both conditions that render this are states of
 * the environment rather than events — they do not pass, and a notice that can be waved
 * away becomes a notice that is always waved away. The one dismissible message in this app
 * is the recovered-session notice, and that one is dismissible precisely because it *is* an
 * event: it happened once, the user has been told, and it is over.
 *
 * This replaces the screen rather than sitting above it. The alternative — showing the
 * capture surface with a warning attached — invites typing into a textarea whose save is
 * going to throw, which is a worse failure than being told plainly that it will.
 */

export interface BlockingNoticeProps {
  title: string;
  /** What went wrong, in the user's terms rather than the exception's. */
  explanation: string;
  /** The one thing worth doing about it. */
  action: string;
  /** Shown small and last. For the person debugging, not the person capturing. */
  detail?: string;
  testId: string;
}

export function BlockingNotice({
  title,
  explanation,
  action,
  detail,
  testId,
}: BlockingNoticeProps) {
  return (
    <main
      data-testid={testId}
      role="alert"
      className="flex min-h-[100dvh] items-center justify-center p-6"
    >
      <div className="flex max-w-md flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-5">
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="text-sm opacity-90">{explanation}</p>
        <p className="text-sm font-medium">{action}</p>
        {detail && (
          <p
            data-testid={`${testId}-detail`}
            className="mt-1 font-mono text-xs break-words opacity-60"
          >
            {detail}
          </p>
        )}
      </div>
    </main>
  );
}
