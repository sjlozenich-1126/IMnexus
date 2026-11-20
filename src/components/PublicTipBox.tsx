import React, { useState } from 'react';
import { Check, Copy, Mail, Send, ShieldAlert } from 'lucide-react';

const RECIPIENT_EMAIL = 'demopocrisyrepository@gmail.com';

interface PublicTipBoxProps {
  contextLabel?: string;
}

export const PublicTipBox: React.FC<PublicTipBoxProps> = ({ contextLabel }) => {
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState(contextLabel ? `Tip / Inquiry: ${contextLabel}` : '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${RECIPIENT_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: subject.trim() || 'IMnexus Public Archive — New Tip / Message',
          _template: 'table',
          _captcha: 'false',
          source: contextLabel || 'IMnexus Public Archive',
          sender_name: senderName.trim() || 'Anonymous Tipster',
          reply_to: senderEmail.trim() || 'not-provided@anonymous',
          message: message.trim(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: string | boolean;
        message?: string;
      };

      if (!response.ok || payload.success === 'false' || payload.success === false) {
        throw new Error(
          payload.message ||
            'Direct web relay could not complete automatically. Use Open Email App below to send directly.'
        );
      }

      setStatus({
        type: 'success',
        text: `Dispatched to ${RECIPIENT_EMAIL}. If this is the very first web tip received at that inbox, click the one-time FormSubmit activation link sent to ${RECIPIENT_EMAIL}.`,
      });
      setMessage('');
      setSenderName('');
      setSenderEmail('');
      setSubject(contextLabel ? `Tip / Inquiry: ${contextLabel}` : '');
    } catch (err) {
      setStatus({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to send via web relay. Please use Open Email App below.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const mailtoHref = `mailto:${RECIPIENT_EMAIL}?subject=${encodeURIComponent(
    subject.trim() || `IMnexus Tip${contextLabel ? ` (${contextLabel})` : ''}`
  )}&body=${encodeURIComponent(
    `${message.trim()}${senderName.trim() ? `\n\nFrom: ${senderName.trim()}` : ''}`
  )}`;

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(RECIPIENT_EMAIL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="tips"
      className="bg-[#faf8f4] dark:bg-[#141715] border border-[#ddd8ce] dark:border-[#262b27] overflow-hidden"
    >
      <div className="h-1 w-full bg-[#ef4423]" />
      <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ef4423] dark:text-[#ff6b3d]">
            Public Correspondence &amp; Tips
          </div>
          <h2 className="font-serif-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#0f1210] dark:text-[#f3f0e9]">
            Submit a Message or Investigative Tip
          </h2>
          <p className="text-sm text-[#4a514b] dark:text-[#a6aba7] leading-relaxed">
            Have supplemental filings, corrections, video links, institutional leads, or confidential tips related to any published dossier? Messages sent here route directly to the archive maintainer inbox.
          </p>

          <div className="p-4 bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-[#0f1210] dark:text-[#f3f0e9]">
              <Mail className="w-4 h-4 text-[#ef4423] dark:text-[#ff6b3d]" />
              <span className="font-mono-tabular break-all">{RECIPIENT_EMAIL}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#ef4423] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#ef4423]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Address' : 'Copy Email'}</span>
              </button>
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-[#faf8f4] dark:bg-[#161916] hover:border-[#ef4423] transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Email App</span>
              </a>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-[#6a716b] dark:text-[#8d948e]">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#ef4423] dark:text-[#ff6b3d] mt-0.5" />
            <span>
              Name and return email are optional. Include relevant case numbers, URLs, or dates to assist review.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
          {status && (
            <div
              className={`p-3.5 text-xs leading-relaxed border ${
                status.type === 'success'
                  ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#065f46] dark:text-[#6ee7b7]'
                  : 'bg-[#ef4423]/10 border-[#ef4423]/40 text-[#b91c1c] dark:text-[#fca5a5]'
              }`}
            >
              {status.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-mono-tabular uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#9ca39d] mb-1.5">
                Name or Alias (Optional)
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Anonymous or full name"
                className="w-full px-3 py-2.5 min-h-[44px] text-sm bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none focus:border-[#ef4423]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono-tabular uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#9ca39d] mb-1.5">
                Return Email (Optional)
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="reply@example.com"
                className="w-full px-3 py-2.5 min-h-[44px] text-sm bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none focus:border-[#ef4423]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono-tabular uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#9ca39d] mb-1.5">
              Subject / Related Case or Project
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Supplemental video link for Case 658931"
              className="w-full px-3 py-2.5 min-h-[44px] text-sm bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none focus:border-[#ef4423]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono-tabular uppercase tracking-[0.1em] text-[#6a716b] dark:text-[#9ca39d] mb-1.5">
              Message or Tip Details *
            </label>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the record, evidence source, video URL, correction, or tip…"
              className="w-full px-3 py-2.5 text-sm bg-[#f3f0e9] dark:bg-[#0c0e0c] border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] outline-none focus:border-[#ef4423]"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] font-mono-tabular text-[#6a716b] dark:text-[#8d948e]">
              Delivers to {RECIPIENT_EMAIL}
            </span>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-xs font-semibold uppercase tracking-[0.08em] bg-[#ef4423] hover:bg-[#d63618] text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Sending Tip…' : 'Send Message / Tip'}</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
