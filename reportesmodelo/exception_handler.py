from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def drf_exception_handler(exc, context):
    """Custom DRF exception handler that returns a consistent JSON structure.

    It delegates to DRF's default handler for known exceptions and normalizes
    the response body. For unhandled exceptions it logs and returns a safe
    JSON error with HTTP 500.
    """
    # Let DRF build the standard error response first
    response = drf_exception_handler(exc, context)

    if response is not None:
        # Normalize the response data into a predictable shape
        original = response.data
        normalized = {
            "error": True,
            "detail": original,
            "status_code": response.status_code,
        }
        return Response(normalized, status=response.status_code)

    # Non-DRF exceptions: log with traceback and return safe JSON
    logger.exception("Unhandled exception in API request", exc_info=exc)
    return Response(
        {"error": True, "detail": "Internal server error", "exception": str(exc)},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
