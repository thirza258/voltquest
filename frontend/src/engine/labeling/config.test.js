import { describe, expect, it } from 'vitest'
import { analyzeConfig, checkTasks, resolvePath, variablesOf } from './config.js'
import { parseXml, XmlError } from './xml.js'

const T = '<Text name="t" value="$text"/>'
// Each case was posted to Label Studio 1.23.1's /api/projects/validate/ on 2026-09-28.
// `saved: true` = HTTP 204 (Label Studio accepts it); false = HTTP 400 with the quoted reason.
const PROBED = {
  ok_basic: [true, `<View>${T}<Choices name="c" toName="t"><Choice value="A"/><Choice value="B"/></Choices></View>`],
  lowercase_tags: [true, '<view><text name="t" value="$text"/><choices name="c" toName="t"><choice value="A"/></choices></view>'],
  lowercase_toname_attr: [false, `<View>${T}<Choices name="c" toname="t"><Choice value="A"/></Choices></View>`],
  duplicate_names: [false, `<View>${T}<Choices name="t" toName="t"><Choice value="A"/></Choices></View>`],
  choices_no_children: [false, `<View>${T}<Choices name="c" toName="t"></Choices></View>`],
  labels_no_children: [false, `<View>${T}<Labels name="l" toName="t"></Labels></View>`],
  rectlabels_no_children: [true, '<View><Image name="img" value="$image"/><RectangleLabels name="r" toName="img"></RectangleLabels></View>'],
  labels_duplicate_values: [true, `<View>${T}<Labels name="l" toName="t"><Label value="A"/><Label value="A"/></Labels></View>`],
  unknown_tag: [true, `<View>${T}<Foo name="x"/><Choices name="c" toName="t"><Choice value="A"/></Choices></View>`],
  text_value_without_dollar: [true, '<View><Text name="t" value="text"/><Choices name="c" toName="t"><Choice value="A"/></Choices></View>'],
  text_missing_name: [false, '<View><Text value="$text"/><Choices name="c" toName="t"><Choice value="A"/></Choices></View>'],
  image_missing_value: [false, '<View><Image name="img"/><RectangleLabels name="r" toName="img"><Label value="A"/></RectangleLabels></View>'],
  label_missing_value: [false, `<View>${T}<Labels name="l" toName="t"><Label/></Labels></View>`],
  choice_missing_value: [false, `<View>${T}<Choices name="c" toName="t"><Choice/></Choices></View>`],
  text_inside_label: [false, `<View>${T}<Labels name="l" toName="t"><Label>Device</Label></Labels></View>`],
  rect_on_text: [true, `<View>${T}<RectangleLabels name="r" toName="t"><Label value="A"/></RectangleLabels></View>`],
  toName_is_control: [true, `<View>${T}<Choices name="c" toName="t"><Choice value="A"/></Choices><TextArea name="ta" toName="c"/></View>`],
  toName_multi_one_missing: [false, `<View>${T}<Pairwise name="p" toName="t,zz"/></View>`],
  root_not_view: [true, '<Text name="t" value="$text"/>'],
  two_roots: [false, `<View>${T}</View><View/>`],
  choice_enum_invalid: [true, `<View>${T}<Choices name="c" toName="t" choice="several"><Choice value="A"/></Choices></View>`],
  required_yes: [true, `<View>${T}<Choices name="c" toName="t" required="yes"><Choice value="A"/></Choices></View>`],
  relations_empty: [true, `<View>${T}<Labels name="l" toName="t"><Label value="A"/></Labels><Relations></Relations></View>`],
  header_no_value: [true, `<View><Header/>${T}<Choices name="c" toName="t"><Choice value="A"/></Choices></View>`],
  rating_maxrating_text: [true, `<View>${T}<Rating name="r" toName="t" maxRating="ten"/></View>`],
  choice_empty_value: [true, `<View>${T}<Choices name="c" toName="t"><Choice value=""/></Choices></View>`],
  unclosed_tag: [false, `<View>${T}<Choices name="c" toName="t"><Choice value="A"/></View>`],
  no_control_tags: [true, `<View>${T}</View>`],
  control_missing_toName: [false, `<View>${T}<Choices name="c"><Choice value="A"/></Choices></View>`],
  control_missing_name: [false, `<View>${T}<Choices toName="t"><Choice value="A"/></Choices></View>`],
  pairwise_one_target: [true, `<View>${T}<Pairwise name="p" toName="t"/></View>`],
  timeseries_json: [true, '<View><TimeSeries name="ts" value="$series" valueType="json" timeColumn="time"><Channel column="temperature"/></TimeSeries><TimeSeriesLabels name="ev" toName="ts"><Label value="Spike"/></TimeSeriesLabels></View>'],
  keypoint_on_image: [true, '<View><Image name="img" value="$image"/><KeyPointLabels name="kp" toName="img"><Label value="Rotor"/></KeyPointLabels></View>'],
  labels_on_image: [true, '<View><Image name="img" value="$image"/><Labels name="l" toName="img"><Label value="A"/></Labels><Rectangle name="r" toName="img"/></View>'],
  choices_dynamic_value: [true, `<View>${T}<Choices name="c" toName="t" value="$options"/></View>`],
  taxonomy_nested: [true, `<View>${T}<Taxonomy name="tx" toName="t"><Choice value="Hardware"><Choice value="Battery"/></Choice></Taxonomy></View>`],
  view_nested: [true, `<View><View style="display:flex">${T}</View><Choices name="c" toName="t"><Choice value="A"/></Choices></View>`],
  doctype: [false, '<!DOCTYPE View [<!ENTITY x "y">]><View><Text name="t" value="&x;"/></View>'],
  entity_amp: [true, `<View><Header value="Tom &amp; Jerry"/>${T}<Choices name="c" toName="t"><Choice value="A&amp;B"/></Choices></View>`],
  comment: [true, `<View><!-- note -->${T}<Choices name="c" toName="t"><Choice value="A"/></Choices></View>`],
  style_tag: [true, `<View><Style>.x { color: red; }</Style>${T}<Choices name="c" toName="t"><Choice value="A"/></Choices></View>`],
  attr_no_quotes: [false, `<View>${T}<Choices name=c toName="t"><Choice value="A"/></Choices></View>`],
  lt_in_attr: [false, `<View>${T}<Choices name="c" toName="t"><Choice value="a<b"/></Choices></View>`],
  dup_attr: [false, `<View>${T}<Choices name="c" name="d" toName="t"><Choice value="A"/></Choices></View>`],
  empty_string: [false, ''],
  whitespace_name: [true, '<View><Text name="my text" value="$text"/><Choices name="c" toName="my text"><Choice value="A"/></Choices></View>'],
}

describe('configuration checker agrees with Label Studio 1.23.1 on what it saves', () => {
  for (const [id, [saved, xml]] of Object.entries(PROBED)) {
    it(`${saved ? 'accepts' : 'rejects'} ${id}`, () => {
      const report = analyzeConfig(xml)
      expect(report.ok, JSON.stringify(report.rejections)).toBe(saved)
    })
  }

  it('explains saved-but-broken configurations as warnings instead of passing them silently', () => {
    const warningFor = id => analyzeConfig(PROBED[id][1]).warnings.map(item => item.message).join('\n')
    expect(warningFor('rect_on_text')).toMatch(/labels Image objects, not <Text>/)
    expect(warningFor('unknown_tag')).toMatch(/<Foo> is not a Label Studio tag/)
    expect(warningFor('text_value_without_dollar')).toMatch(/has no \$field/)
    expect(warningFor('choice_enum_invalid')).toMatch(/choice="several" is not one of single, single-radio, multiple/)
    expect(warningFor('required_yes')).toMatch(/required="yes" is not "true" or "false"/)
    expect(warningFor('labels_duplicate_values')).toMatch(/repeats the value "A"/)
    expect(warningFor('pairwise_one_target')).toMatch(/exactly two different names/)
    expect(warningFor('toName_is_control')).toMatch(/not an object tag/)
    expect(warningFor('no_control_tags')).toMatch(/no control tag/)
    expect(warningFor('root_not_view')).toMatch(/root element is <Text>/)
    expect(analyzeConfig(PROBED.ok_basic[1]).warnings).toEqual([])
  })

  it('reports the same reasons Label Studio returns for rejected bindings', () => {
    const missing = analyzeConfig(PROBED.toName_multi_one_missing[1])
    expect(missing.rejections[0].message).toBe(`toName="zz" not found in names: ['p', 't'].`)
    expect(analyzeConfig(PROBED.duplicate_names[1]).rejections[0].message).toMatch(/used more than once/)
    expect(analyzeConfig(PROBED.two_roots[1]).rejections[0]).toMatchObject({ line: 1 })
    expect(analyzeConfig(PROBED.doctype[1]).rejections[0].message).toMatch(/Document type declarations are not allowed/)
  })
})

describe('bindings, data fields and the studio subset', () => {
  const config = `<View>
  <Header value="Which area should handle this ticket?"/>
  <Text name="ticket" value="$text"/>
  <Choices name="area" toName="ticket" choice="single" showInline="true" required="true">
    <Choice value="Battery" hotkey="1"/><Choice value="Connectivity" hotkey="2"/>
  </Choices>
  <Image name="photo" value="$meta.photo"/>
  <BrushLabels name="mask" toName="photo"><Label value="Panel"/></BrushLabels>
</View>`

  it('maps controls to objects and lists tags the studio does not render', () => {
    const report = analyzeConfig(config)
    expect(report.ok).toBe(true)
    expect(report.objects.map(o => [o.name, o.tag, o.variable])).toEqual([['ticket', 'Text', 'text'], ['photo', 'Image', 'meta.photo']])
    expect(report.controls.map(c => [c.name, c.resultType, c.toName, c.labels.map(l => l.value)])).toEqual([
      ['area', 'choices', ['ticket'], ['Battery', 'Connectivity']], ['mask', 'brushlabels', ['photo'], ['Panel']]])
    expect(report.dataKeys).toEqual(['text', 'meta.photo'])
    expect(report.unsupported).toEqual(['BrushLabels'])
  })

  it('checks each task for every $field the objects read', () => {
    const report = analyzeConfig(config)
    const findings = checkTasks(report, [{ data: { text: 'ok', meta: { photo: 'a.svg' } } }, { data: { text: 'no photo' } }])
    expect(findings.map(item => item.message)).toEqual(['Task 2: data.meta.photo is missing, so <Image name="photo"> will be empty.'])
    expect(resolvePath({ texts: ['a', 'b', 'c'] }, 'texts[2]')).toBe('c')
    expect(variablesOf('Ticket $ref_id for $meta.device')).toEqual(['ref_id', 'meta.device'])
  })

  it('warns about duplicate hotkeys and choice visibility rules without rejecting', () => {
    const report = analyzeConfig(`<View>${T}<Choices name="a" toName="t"><Choice value="A" hotkey="1"/></Choices><Choices name="b" toName="t" visibleWhen="choice-selected" whenTagName="a"><Choice value="B" hotkey="1"/></Choices></View>`)
    expect(report.ok).toBe(true)
    expect(report.warnings.map(item => item.message)).toEqual([
      'Hotkey "1" is assigned twice; one of the labels will not be reachable by keyboard.',
      'Choices visibleWhen="choice-selected" needs both whenTagName and whenChoiceValue.',
    ])
  })
})

describe('bounded XML parser', () => {
  it('decodes entities, keeps line numbers and rejects unsafe or oversized input', () => {
    const { root } = parseXml('<?xml version="1.0"?>\n<View>\n  <Header value="A &amp; B &#x2713;"/>\n</View>')
    expect(root.children.find(child => child.type === 'element')).toMatchObject({ name: 'Header', attrs: { value: 'A & B ✓' }, line: 3 })
    expect(() => parseXml('<View><A></B></View>')).toThrow(XmlError)
    expect(() => parseXml('<View>&nbsp;</View>')).toThrow(/Unknown entity &nbsp;/)
    expect(() => parseXml('x'.repeat(70000))).toThrow(/larger than 65536 bytes/)
    expect(() => parseXml(`${'<View>'.repeat(40)}${'</View>'.repeat(40)}`)).toThrow(/deeper than 32/)
    let error
    try { parseXml('<View>\n<Choices name="c"\n toName=t/></View>') } catch (caught) { error = caught }
    expect(error).toMatchObject({ line: 3, reason: 'Attribute toName value must be quoted' })
  })
})
