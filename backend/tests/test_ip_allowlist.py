import sys
import types
from unittest.mock import MagicMock

import pytest


@pytest.fixture(scope="module", autouse=True)
def stub_external_dependencies():
    preserved_modules = {}
    module_names = [
        "firebase_admin",
        "firebase_admin.credentials",
        "firebase_admin.firestore",
        "firebase_admin.storage",
        "deepface",
        "cv2",
        "numpy",
    ]

    for name in module_names:
        if name in sys.modules:
            preserved_modules[name] = sys.modules.pop(name)

    firebase_admin = types.ModuleType("firebase_admin")
    firebase_admin.initialize_app = lambda cred, options=None: None

    credentials = types.ModuleType("firebase_admin.credentials")
    credentials.Certificate = lambda path: object()

    fake_db = MagicMock()
    firestore = types.ModuleType("firebase_admin.firestore")
    firestore.client = lambda: fake_db

    fake_bucket = MagicMock()
    storage = types.ModuleType("firebase_admin.storage")
    storage.bucket = lambda: fake_bucket

    firebase_admin.credentials = credentials
    firebase_admin.firestore = firestore
    firebase_admin.storage = storage

    sys.modules["firebase_admin"] = firebase_admin
    sys.modules["firebase_admin.credentials"] = credentials
    sys.modules["firebase_admin.firestore"] = firestore
    sys.modules["firebase_admin.storage"] = storage

    deepface = types.ModuleType("deepface")

    class DummyDeepFace:
        @staticmethod
        def verify(*args, **kwargs):
            return {"verified": True}

    deepface.DeepFace = DummyDeepFace
    sys.modules["deepface"] = deepface

    cv2 = types.ModuleType("cv2")
    cv2.IMREAD_COLOR = 1
    cv2.imdecode = lambda array, flags: array
    cv2.imwrite = lambda path, img: True
    sys.modules["cv2"] = cv2

    numpy = types.ModuleType("numpy")
    numpy.uint8 = int
    numpy.frombuffer = lambda buffer, dtype: buffer
    sys.modules["numpy"] = numpy

    try:
        yield
    finally:
        for name in module_names:
            sys.modules.pop(name, None)
        sys.modules.update(preserved_modules)


@pytest.fixture(scope="module")
def app_module():
    from backend import app as app_module

    return app_module


def test_allowed_ip_via_forwarded_header(monkeypatch, app_module):
    processed = {}

    def fake_processor():
        processed["called"] = True
        return app_module.jsonify({"status": "ok"}), 200

    monkeypatch.setattr(app_module, "_process_face_recognition_request", fake_processor)

    client = app_module.app.test_client()
    response = client.post(
        "/api/face-recognition",
        json={},
        headers={"X-Forwarded-For": "129.120.1.10, 198.51.100.5"},
        environ_base={"REMOTE_ADDR": "203.0.113.8"},
    )

    assert response.status_code == 200
    assert processed.get("called")


def test_disallowed_ip_short_circuits(monkeypatch, app_module, caplog):
    def fail_processor():
        raise AssertionError("Processor should not be invoked for disallowed IPs")

    monkeypatch.setattr(app_module, "_process_face_recognition_request", fail_processor)

    client = app_module.app.test_client()

    with caplog.at_level("WARNING"):
        response = client.post(
            "/api/face-recognition",
            json={},
            environ_base={"REMOTE_ADDR": "203.0.113.10"},
        )

    assert response.status_code == 403
    assert "unauthorized IP" in caplog.text
