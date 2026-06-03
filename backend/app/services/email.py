"""Email notifications via Resend. All calls are fire-and-forget — errors are
logged but never propagate to the caller so they don't break the main flow."""
import asyncio
import logging

logger = logging.getLogger(__name__)


async def send_supplier_site_assigned(
    supplier_email: str,
    supplier_name: str,
    site_code: str,
    site_name: str,
) -> None:
    """Notify a supplier when HO assigns them to a new site."""
    from app.core.config import settings

    if not settings.RESEND_API_KEY:
        logger.info("RESEND_API_KEY not configured — skipping email to %s", supplier_email)
        return

    try:
        import resend  # type: ignore

        resend.api_key = settings.RESEND_API_KEY

        html = f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#16110D;margin-bottom:8px">Akses Site Baru</h2>
          <p style="color:#4A4035;line-height:1.6">
            Halo <strong>{supplier_name}</strong>,
          </p>
          <p style="color:#4A4035;line-height:1.6">
            Anda telah di-assign ke site baru:
          </p>
          <div style="background:#DCEEE3;border-radius:12px;padding:16px 20px;margin:20px 0">
            <span style="font-family:monospace;font-weight:700;font-size:18px;color:#1F6F4C">
              {site_code}
            </span>
            <span style="color:#2D6A4F;font-size:14px;margin-left:12px">{site_name}</span>
          </div>
          <p style="color:#4A4035;line-height:1.6">
            Silakan <strong>login kembali</strong> untuk mengakses data site tersebut.
            Jika ada pertanyaan, hubungi tim HO.
          </p>
          <hr style="border:none;border-top:1px solid #EDE9E0;margin:28px 0">
          <p style="color:#9E9489;font-size:12px">UT STOCK · KPP Mining</p>
        </div>
        """

        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [supplier_email],
                "subject": f"Anda telah di-assign ke site {site_code} — UT STOCK",
                "html": html,
            },
        )
        logger.info("Site assignment email sent to %s (site %s)", supplier_email, site_code)

    except Exception as exc:
        logger.error(
            "Failed to send site assignment email to %s: %s", supplier_email, exc
        )
