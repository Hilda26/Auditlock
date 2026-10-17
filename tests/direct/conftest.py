"""Work around gltest unlinking its still-open stdin temp file on Windows.

Only the direct harness's own deletion calls are affected. Retry cleanup after
the harness has restored stdin; production contract behavior is unchanged.
"""
import os
from pathlib import Path
import gltest.direct.loader as loader

_pending = []
_real_unlink = os.unlink


class _HarnessOS:
    def __getattr__(self, name):
        return getattr(os, name)


def pytest_configure(config):
    if os.name != "nt":
        return
    import inspect
    def windows_unlink(path, *args, **kwargs):
        try:
            return _real_unlink(path, *args, **kwargs)
        except PermissionError:
            caller = inspect.currentframe().f_back
            if caller and Path(caller.f_code.co_filename) == Path(loader.__file__):
                _pending.append(path)
                return None
            raise
    os.unlink = windows_unlink


def pytest_unconfigure(config):
    os.unlink = _real_unlink
    for path in _pending:
        try:
            _real_unlink(path)
        except (PermissionError, FileNotFoundError):
            pass
