export function optimizeContext({ core, originalPrompt, skills = [], anchors = [], template, maximumChars = 18000 }) {
  const sections = [
    { id: 'core', priority: 100, mandatory: true, content: core ?? '' },
    { id: 'original-prompt', priority: 100, mandatory: true, content: originalPrompt ?? '' },
    ...skills.map((skill, index) => ({ id: `skill:${skill.name}`, priority: 90 - index * 10, mandatory: index === 0, content: skill.content ?? '' })),
    ...anchors.map((anchor, index) => ({ id: `anchor:${anchor.path ?? index}`, priority: 70 - index, mandatory: false, content: anchor.content ?? '' })),
    { id: 'template', priority: 50, mandatory: false, content: template?.body ?? '' },
  ].filter((section) => section.content.trim());
  const mandatory = sections.filter((section) => section.mandatory);
  const optional = sections.filter((section) => !section.mandatory).sort((a, b) => b.priority - a.priority);
  const selected = [...mandatory];
  let usedChars = mandatory.reduce((total, section) => total + section.content.length, 0);
  for (const section of optional) {
    if (usedChars + section.content.length > maximumChars) continue;
    selected.push(section); usedChars += section.content.length;
  }
  return { sections: selected, usedChars, droppedSections: sections.filter((section) => !selected.includes(section)).map((section) => section.id) };
}
