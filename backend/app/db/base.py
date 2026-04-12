# Import all models here so Alembic can detect them
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.farm import Farm  # noqa
from app.models.animal import Animal  # noqa
from app.models.event import Event  # noqa
from app.models.invitation import Invitation  # noqa