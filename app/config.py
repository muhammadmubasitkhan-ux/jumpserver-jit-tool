from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "JumpServer JIT Access Portal"
    debug: bool = False

    jumpserver_url: str = "https://jump.plano-wfm.cloud"
    jumpserver_private_token: str = ""
    jumpserver_org_id: str = "00000000-0000-0000-0000-000000000002"

    database_url: str = "sqlite:///./jit_access.db"

    # JIT defaults
    default_access_duration_minutes: int = 120
    max_access_duration_minutes: int = 480
    auto_cleanup_interval_minutes: int = 15

    # Notification (optional)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notification_from_email: str = ""

    # Portal session signing
    secret_key: str = "change-this-to-a-random-secret-key"

    class Config:
        env_file = ".env"
        env_prefix = "JIT_"


@lru_cache
def get_settings() -> Settings:
    return Settings()
