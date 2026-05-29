from fastapi import HTTPException


class AtelierException(HTTPException):
    def __init__(self, status_code: int, code: str, detail: str = "", context: dict | None = None):
        super().__init__(status_code=status_code, detail={"code": code, "detail": detail, "context": context or {}})


class NotFoundError(AtelierException):
    def __init__(self, resource: str):
        super().__init__(404, "NOT_FOUND", f"{resource} not found")


class ForbiddenError(AtelierException):
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(403, "FORBIDDEN", detail)


class ConflictError(AtelierException):
    def __init__(self, detail: str):
        super().__init__(409, "CONFLICT", detail)


class ValidationError(AtelierException):
    def __init__(self, detail: str, context: dict | None = None):
        super().__init__(422, "VALIDATION_ERROR", detail, context)
