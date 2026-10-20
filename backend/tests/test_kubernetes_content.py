"""The Kubernetes course manifests must be valid, well-structured Kubernetes YAML.

Every course supplies a complete, parseable Kubernetes manifest (YAML documents).
This test parses all multi-document YAML manifests using PyYAML, verifies that all
documents conform to standard Kubernetes resource structures (apiVersion, kind, metadata.name),
checks that Deployment/StatefulSet/Service selectors and labels match, validates port definitions,
and asserts that the full course curriculum adheres to the ReadingTrack specification.
"""

import json
from pathlib import Path
import yaml

CONTENT = Path(__file__).resolve().parents[2] / "content"


def test_every_kubernetes_manifest_is_valid_and_structured():
    courses = json.loads((CONTENT / "kubernetes.json").read_text(encoding="utf-8"))["courses"]
    assert len(courses) == 10

    expected_difficulties = {"Fundamental", "Intermediate", "Advanced"}

    for course in courses:
        assert course["id"].startswith("k8s-")
        assert course["version"] == 1
        assert course["difficulty"] in expected_difficulties
        assert course["codeExt"] == "yaml"
        assert len(course["code"]) > 50

        # Parse the YAML code (can be multi-document with ---)
        docs = list(yaml.safe_load_all(course["code"]))
        assert len(docs) >= 1, f"Course {course['id']} YAML is empty"

        for doc in docs:
            assert isinstance(doc, dict), f"{course['id']}: document is not a mapping: {doc!r}"
            assert "apiVersion" in doc and doc["apiVersion"], f"{course['id']}: missing apiVersion in {doc}"
            assert "kind" in doc and doc["kind"], f"{course['id']}: missing kind in {doc}"
            assert "metadata" in doc and isinstance(doc["metadata"], dict), f"{course['id']}: invalid metadata in {doc}"
            assert "name" in doc["metadata"] and doc["metadata"]["name"], f"{course['id']}: missing metadata.name in {doc}"

            # Specific structural checks for Deployments & StatefulSets
            if doc["kind"] in ("Deployment", "StatefulSet"):
                spec = doc.get("spec", {})
                selector = spec.get("selector", {})
                template = spec.get("template", {})
                labels = template.get("metadata", {}).get("labels", {})
                match_labels = selector.get("matchLabels", {})
                for k, v in match_labels.items():
                    assert labels.get(k) == v, f"{course['id']} {doc['kind']}: selector {k}={v} not in pod labels {labels}"

                pod_spec = template.get("spec", {})
                containers = pod_spec.get("containers", [])
                assert len(containers) >= 1, f"{course['id']}: {doc['kind']} has no containers"
                for c in containers:
                    assert "name" in c, f"{course['id']}: container missing name"
                    assert "image" in c, f"{course['id']}: container missing image"

            # Check Services
            elif doc["kind"] == "Service":
                spec = doc.get("spec", {})
                ports = spec.get("ports", [])
                assert len(ports) >= 1, f"{course['id']}: Service has no ports"
                for p in ports:
                    assert "port" in p, f"{course['id']}: Service port missing port number"

        # Validate lessons and questions
        assert len(course["lessons"]) == 4
        lesson_q_ids = set()
        for lesson in course["lessons"]:
            q = lesson["question"]
            assert q["answerId"] in [o["id"] for o in q["options"]]
            lesson_q_ids.add(q["id"])

        assert len(lesson_q_ids) == 4

        # Validate exam
        assert course["exam"]["passPercent"] == 80
        exam_questions = course["exam"]["questions"]
        assert len(exam_questions) == 5
        exam_q_ids = set()
        for q in exam_questions:
            assert q["answerId"] in [o["id"] for o in q["options"]]
            exam_q_ids.add(q["id"])

        assert len(exam_q_ids) == 5
        assert len(lesson_q_ids & exam_q_ids) == 0, f"Overlap between lesson and exam question IDs in {course['id']}"
