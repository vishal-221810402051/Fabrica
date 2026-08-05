from __future__ import annotations

from dataclasses import dataclass


class ProjectModelError(Exception):
    """Base error for persisted project-model handling."""


class ProjectModelValidationError(ProjectModelError):
    """Raised when a project document fails schema validation."""


@dataclass(frozen=True)
class IntegrityIssue:
    code: str
    message: str
    path: str
    entity_id: str | None = None


class ProjectIntegrityError(ProjectModelError):
    def __init__(self, issues: list[IntegrityIssue]) -> None:
        super().__init__(
            f"Project integrity validation failed with {len(issues)} issue(s)"
        )
        self.issues = issues


class UnsupportedVersionError(ProjectModelError):
    def __init__(self, version: str) -> None:
        super().__init__(f"Unsupported project schema version: {version}")


class FutureVersionError(ProjectModelError):
    def __init__(self, version: str) -> None:
        super().__init__(f"Future project schema version is not supported: {version}")
