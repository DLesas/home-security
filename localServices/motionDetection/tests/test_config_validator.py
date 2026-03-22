import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from config.config_validator import ConfigValidator


class ConfigValidatorTests(unittest.TestCase):
    def test_parse_settings_accepts_json_backed_motion_zone_config(self):
        validator = ConfigValidator()

        settings = validator.parse_settings(
            {
                "externalID": "camera-1",
                "name": "Front Door",
                "motionDetectionEnabled": True,
                "detectionModel": "mog2",
                "modelSettings": '{"history": 500, "varThreshold": 16, "detectShadows": false}',
                "motionZones": '[{"id":"front-door","name":"Front Door","points":[[0,0],[200,0],[200,200]],"minContourArea":2500,"thresholdPercent":2.5}]',
                "objectDetectionEnabled": False,
            },
            "Front Door",
        )

        self.assertIsNotNone(settings)
        assert settings is not None
        self.assertEqual(settings.detection_model.value, "mog2")
        self.assertEqual(len(settings.zones), 1)
        self.assertEqual(settings.zones[0].name, "Front Door")
        self.assertEqual(settings.zones[0].points[1], (200, 0))

    def test_parse_settings_rejects_missing_motion_zones(self):
        validator = ConfigValidator()

        settings = validator.parse_settings(
            {
                "externalID": "camera-1",
                "name": "Front Door",
                "motionDetectionEnabled": True,
                "detectionModel": "mog2",
                "modelSettings": {"history": 500, "varThreshold": 16, "detectShadows": False},
                "motionZones": [],
                "objectDetectionEnabled": False,
            },
            "Front Door",
        )

        self.assertIsNone(settings)


if __name__ == "__main__":
    unittest.main()
