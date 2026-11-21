import test from 'node:test';
import assert from 'node:assert/strict';
import lectures from '../src/content/lectures.json' with { type: 'json' };
import topics from '../src/content/topics.json' with { type: 'json' };

test('every topic has three complete guided sections and an explain-it-back exercise', () => {
  assert.deepEqual(Object.keys(lectures).sort(), topics.map(topic => topic.id).sort());
  for (const topic of topics) {
    const lecture = lectures[topic.id];
    assert.equal(lecture.scenes.length, 3, topic.id);
    assert.equal(lecture.points.length, 3, topic.id);
    assert.ok(lecture.goal && lecture.explain && lecture.model, topic.id);
    for (const scene of lecture.scenes) {
      assert.ok(topic.concepts.some(concept => concept.id === scene.concept), scene.title);
      assert.ok(scene.content && scene.check.prompt && scene.check.hint && scene.check.feedback, scene.title);
      assert.equal(scene.check.options.length, 3, scene.title);
      assert.ok(scene.check.options[scene.check.right], scene.title);
      assert.ok(scene.table.rows.length > 1 && scene.table.rows.every(row => row.length === scene.table.columns.length), scene.title);
    }
  }
});
