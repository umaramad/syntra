import pytest

from services.user_settings_service import UserSettingsService


def test_get_settings_returns_defaults_when_empty(db_path):
    settings = UserSettingsService().get_settings()

    assert settings.reminder_notifications_enabled is False
    assert settings.reminder_sound_enabled is False
    assert settings.theme == "light"


def test_update_settings_partial_preserves_other_fields(db_path):
    service = UserSettingsService()

    service.update_settings(reminder_notifications_enabled=True)
    service.update_settings(theme="dark")
    service.update_settings(reminder_sound_enabled=True)

    settings = service.get_settings()
    assert settings.reminder_notifications_enabled is True
    assert settings.reminder_sound_enabled is True
    assert settings.theme == "dark"


def test_update_settings_accepts_system_theme(db_path):
    service = UserSettingsService()

    service.update_settings(theme="system")

    assert service.get_settings().theme == "system"


def test_update_settings_rejects_invalid_theme(db_path):
    service = UserSettingsService()

    with pytest.raises(ValueError, match="Invalid theme"):
        service.update_settings(theme="neon")
