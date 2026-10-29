
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter=Limiter(key_func=get_remote_address)

LOGIN_LIMIT="5/minute"
SIGNUP_LIMIT="10/hour"