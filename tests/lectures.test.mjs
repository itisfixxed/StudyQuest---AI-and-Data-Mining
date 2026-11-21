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

test('the route constraint check includes the inputs it needs in its own section', () => {
  const [fastest, accessible] = lectures.foundations.scenes;
  const { columns, rows } = accessible.table;
  assert.ok(accessible.setup.includes('step-free'));
  assert.deepEqual(accessible.table, fastest.table);
  assert.deepEqual(accessible.check.options, rows.map(([route]) => route));
  const time = columns.indexOf('Predicted time');
  const stepFree = columns.indexOf('Step-free?');
  const winner = candidates => [...candidates].sort((a, b) => parseInt(a[time], 10) - parseInt(b[time], 10))[0][0];
  assert.equal(fastest.check.options[fastest.check.right], winner(rows));
  assert.equal(accessible.check.options[accessible.check.right], winner(rows.filter(row => row[stepFree] === 'Yes')));
  assert.ok(winner(rows) !== winner(rows.filter(row => row[stepFree] === 'Yes')));
});
