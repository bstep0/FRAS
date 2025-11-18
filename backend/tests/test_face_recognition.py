import base64
import datetime
import importlib.util
import sys
import types
from pathlib import Path

import pytest

from concurrent.futures import TimeoutError as FuturesTimeoutError


CENTRAL_TZ = datetime.timezone.utc


class FakeDocumentSnapshot:
    def __init__(self, data, doc_id=None):
        self._data = data
        self._doc_id = doc_id

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        if self._data is None:
            return None
        return dict(self._data)

    @property
    def id(self):
        return self._doc_id


class FakeDocument:
    def __init__(self, store, doc_id):
        self._store = store
        self._doc_id = doc_id

    @property
    def id(self):
        return self._doc_id

    def get(self):
        data = self._store.get(self._doc_id)
        if data is None:
            return FakeDocumentSnapshot(None, self._doc_id)
        return FakeDocumentSnapshot(dict(data), self._doc_id)

    def set(self, data):
        self._store[self._doc_id] = dict(data)

    def update(self, updates):
        if self._doc_id not in self._store:
            raise KeyError("Document does not exist")
        record = self._store[self._doc_id]
        for key, value in updates.items():
            record[key] = value


class FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id):
        return FakeDocument(self._store, doc_id)


class FakeFirestore:
    def __init__(self, classes=None, attendance=None):
        self._collections = {
            "classes": classes or {},
            "attendance": attendance or {},
        }

    def collection(self, name):
        store = self._collections.setdefault(name, {})
        return FakeCollection(store)

    def get_attendance(self, doc_id):
        return self._collections["attendance"].get(doc_id)


class FakeBlob:
    def __init__(self, image_bytes):
        self.image_bytes = image_bytes

    def exists(self):
        return True

    def download_to_filename(self, path):
        Path(path).write_bytes(self.image_bytes)


class FakeBucket:
    def __init__(self, image_bytes):
        self.image_bytes = image_bytes

    def blob(self, _path):
        return FakeBlob(self.image_bytes)


@pytest.fixture
def load_face_app(monkeypatch):
    def _loader(classes=None):
        monkeypatch.setenv("EAGLENET_IP_ALLOWLIST", "10.0.0.0/8")

        preserved_modules = {}
        module_names = [
            "flask",
            "deepface",
            "numpy",
            "cv2",
            "firebase_admin",
            "firebase_admin.credentials",
            "firebase_admin.firestore",
            "firebase_admin.storage",
            "firebase_admin.auth",
        ]

        for name in module_names:
            if name in sys.modules:
                preserved_modules[name] = sys.modules.pop(name)

        class FakeFlask:
            def __init__(self, _name):
                self._after_request_handlers = []
                self.logger = types.SimpleNamespace(exception=lambda *args, **kwargs: None)

            def after_request(self, func):
                self._after_request_handlers.append(func)
                return func

            def route(self, *args, **kwargs):
                def decorator(func):
                    return func

                return decorator

        flask_module = types.ModuleType("flask")
        flask_module.Flask = FakeFlask
        flask_module.request = types.SimpleNamespace()
        flask_module.jsonify = lambda payload: payload
        flask_module.Response = lambda *args, **kwargs: None
        flask_module.stream_with_context = lambda x: x

        deepface_module = types.ModuleType("deepface")

        class _FakeDeepFace:
            @staticmethod
            def verify(*args, **kwargs):
                raise AssertionError("DeepFace.verify should be patched in tests")

        deepface_module.DeepFace = _FakeDeepFace

        numpy_module = types.ModuleType("numpy")
        numpy_module.uint8 = "uint8"
        numpy_module.frombuffer = lambda buffer, dtype: buffer

        cv2_module = types.ModuleType("cv2")
        cv2_module.IMREAD_COLOR = 1
        cv2_module.imdecode = lambda *_args, **_kwargs: [0]
        cv2_module.imwrite = lambda *_args, **_kwargs: True

        firebase_admin_module = types.ModuleType("firebase_admin")
        credentials_module = types.ModuleType("firebase_admin.credentials")
        credentials_module.Certificate = lambda path: object()

        firestore_module = types.ModuleType("firebase_admin.firestore")
        firestore_module.DELETE_FIELD = object()
        firestore_module.SERVER_TIMESTAMP = datetime.datetime(2024, 1, 1, tzinfo=CENTRAL_TZ)
        firestore_module.client = lambda: None

        storage_module = types.ModuleType("firebase_admin.storage")
        storage_module.bucket = lambda: FakeBucket(b"known")

        auth_module = types.ModuleType("firebase_admin.auth")
        auth_module.verify_id_token = lambda *args, **kwargs: {}
        auth_module.InvalidIdTokenError = Exception
        auth_module.ExpiredIdTokenError = Exception
        auth_module.RevokedIdTokenError = Exception

        firebase_admin_module.credentials = credentials_module
        firebase_admin_module.firestore = firestore_module
        firebase_admin_module.storage = storage_module
        firebase_admin_module.auth = auth_module
        firebase_admin_module.initialize_app = lambda *args, **kwargs: None

        sys.modules["flask"] = flask_module
        sys.modules["deepface"] = deepface_module
        sys.modules["numpy"] = numpy_module
        sys.modules["cv2"] = cv2_module
        sys.modules["firebase_admin"] = firebase_admin_module
        sys.modules["firebase_admin.credentials"] = credentials_module
        sys.modules["firebase_admin.firestore"] = firestore_module
        sys.modules["firebase_admin.storage"] = storage_module
        sys.modules["firebase_admin.auth"] = auth_module

        preserved_backend_pkg = sys.modules.get("backend")
        preserved_backend_app = sys.modules.get("backend.app")

        sys.modules.pop("backend", None)
        sys.modules.pop("backend.app", None)

        backend_pkg = types.ModuleType("backend")
        backend_pkg.__path__ = [str(Path(__file__).resolve().parents[1])]
        sys.modules["backend"] = backend_pkg

        module_path = Path(__file__).resolve().parents[1] / "app.py"
        spec = importlib.util.spec_from_file_location("backend.app", module_path)
        app_module = importlib.util.module_from_spec(spec)
        sys.modules["backend.app"] = app_module
        spec.loader.exec_module(app_module)

        class_data = classes or {"CPSC101": {"schedule": "MTWRF 12:00AM - 11:59PM"}}
        fake_db = FakeFirestore(classes=dict(class_data))
        fake_bucket = FakeBucket(b"known")

        app_module.db = fake_db
        app_module.bucket = fake_bucket

        for name in module_names:
            sys.modules.pop(name, None)
            if name in preserved_modules:
                sys.modules[name] = preserved_modules[name]

        if preserved_backend_app is not None:
            sys.modules["backend.app"] = preserved_backend_app
        else:
            sys.modules.pop("backend.app", None)

        if preserved_backend_pkg is not None:
            sys.modules["backend"] = preserved_backend_pkg
        else:
            sys.modules.pop("backend", None)

        return app_module, fake_db, fake_bucket

    return _loader


def _build_image_b64():
    raw = b"captured-image"
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")


def test_face_recognition_happy_path(monkeypatch, load_face_app):
    app_module, fake_db, _ = load_face_app()

    verify_result = {"verified": True, "distance": 0.1, "max_threshold_to_verify": 0.3}
    monkeypatch.setattr(app_module, "_perform_face_verification", lambda *args, **kwargs: verify_result)

    payload = {"image": _build_image_b64(), "classId": "CPSC101", "studentId": "A123"}
    app_module.request = types.SimpleNamespace(
        headers={"X-Forwarded-For": "10.0.0.5"},
        remote_addr="10.0.0.5",
        get_json=lambda: payload,
    )

    response, status = app_module._process_face_recognition_request()

    assert status == 202
    assert response["status"] == "pending"
    assert response["recognized_student"] == "A123"

    created_records = fake_db.get_attendance(response["recordId"])
    assert created_records["status"] == "pending"
    assert created_records["proposedStatus"] == "Present"
    assert created_records["verification"]["distance"] == verify_result["distance"]


def test_face_recognition_verification_timeout(monkeypatch, load_face_app):
    app_module, _, _ = load_face_app()

    monkeypatch.setattr(
        app_module,
        "_perform_face_verification",
        lambda *args, **kwargs: (_ for _ in ()).throw(FuturesTimeoutError()),
    )

    payload = {"image": _build_image_b64(), "classId": "CPSC101", "studentId": "A123"}
    app_module.request = types.SimpleNamespace(
        headers={"X-Forwarded-For": "10.0.0.5"},
        remote_addr="10.0.0.5",
        get_json=lambda: payload,
    )

    response, status = app_module._process_face_recognition_request()

    assert status == 504
    assert response["status"] == "error"
    assert "timed out" in response["message"].lower()


def test_face_recognition_verification_failure(monkeypatch, load_face_app):
    app_module, _, _ = load_face_app()

    monkeypatch.setattr(
        app_module,
        "_perform_face_verification",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("verify failed")),
    )

    payload = {"image": _build_image_b64(), "classId": "CPSC101", "studentId": "A123"}
    app_module.request = types.SimpleNamespace(
        headers={"X-Forwarded-For": "10.0.0.5"},
        remote_addr="10.0.0.5",
        get_json=lambda: payload,
    )

    response, status = app_module._process_face_recognition_request()

    assert status == 502
    assert response["status"] == "error"
    assert "failed" in response["message"].lower()
