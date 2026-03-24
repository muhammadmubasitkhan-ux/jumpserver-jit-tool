"""Notification service — sends email alerts for JIT access events."""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body_html: str):
    settings = get_settings()
    if not settings.smtp_host:
        logger.debug("SMTP not configured, skipping email notification")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.notification_from_email
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.notification_from_email, to, msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)


def notify_new_request(request: dict):
    subject = f"[JIT Access] New request from {request['requester']}"
    body = f"""
    <h3>New JIT Access Request</h3>
    <table>
        <tr><td><b>Requester:</b></td><td>{request['requester']}</td></tr>
        <tr><td><b>JumpServer User:</b></td><td>{request['jumpserver_user']}</td></tr>
        <tr><td><b>Asset:</b></td><td>{request['asset_hostname']}</td></tr>
        <tr><td><b>Accounts:</b></td><td>{request['accounts']}</td></tr>
        <tr><td><b>Duration:</b></td><td>{request['duration_minutes']} minutes</td></tr>
        <tr><td><b>Reason:</b></td><td>{request['reason']}</td></tr>
    </table>
    <p>Please review this request in the JIT Access Portal.</p>
    """
    send_email("approvers@example.com", subject, body)


def notify_request_approved(request: dict):
    if not request.get("requester_email"):
        return
    subject = f"[JIT Access] Your request has been approved"
    body = f"""
    <h3>Access Granted</h3>
    <p>Your JIT access request has been <b>approved</b>.</p>
    <table>
        <tr><td><b>Asset:</b></td><td>{request['asset_hostname']}</td></tr>
        <tr><td><b>Expires:</b></td><td>{request['access_expiry']}</td></tr>
        <tr><td><b>Reviewer:</b></td><td>{request['reviewer']}</td></tr>
    </table>
    <p>You can now connect via JumpServer.</p>
    """
    send_email(request["requester_email"], subject, body)


def notify_request_denied(request: dict):
    if not request.get("requester_email"):
        return
    subject = f"[JIT Access] Your request has been denied"
    body = f"""
    <h3>Access Denied</h3>
    <p>Your JIT access request for <b>{request['asset_hostname']}</b> was denied.</p>
    <p><b>Reviewer:</b> {request['reviewer']}</p>
    <p><b>Comment:</b> {request.get('review_comment', 'N/A')}</p>
    """
    send_email(request["requester_email"], subject, body)
