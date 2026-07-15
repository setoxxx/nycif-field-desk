(() => {
  'use strict';

  const VERSION = 'nycif-candidate-source-evaluation-v01';
  const VALIDATED_ON = '2026-07-15';

  function candidates() {
    return [
      {
        decision: 'integrated',
        decisionLabel: 'ALREADY IN USE',
        connected: true,
        sourceName: 'NYC Permitted Event Information',
        agencyLane: 'SAPO / city-permitted events',
        datasetId: 'tvpp-9vvx',
        endpoint: 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json',
        datasetPage: 'https://data.cityofnewyork.us/d/tvpp-9vvx',
        validation: 'Official dataset page and JSON endpoint are active. The endpoint returned current 2026 event records.',
        uniqueSignal: 'Primary event identity, start/end time, agency, event type, borough, location, street-closure type and CEMSID.',
        overlapRisk: 'This is the NYCIF baseline. Every new event source must be compared against event_id, CEMSID and normalized title + borough + location + date.',
        safeNextStep: 'Keep as the primary approved event source. No pipeline change is required.',
        caution: 'The feed contains routine Parks and sports records as well as high-value street activity, so NYCIF classification and ranking remain necessary.'
      },
      {
        decision: 'test',
        decisionLabel: 'SHADOW TEST',
        connected: false,
        sourceName: 'Film Permits',
        agencyLane: 'MOME filming activity',
        datasetId: 'tg4x-b46p',
        endpoint: 'https://data.cityofnewyork.us/resource/tg4x-b46p.json',
        datasetPage: 'https://data.cityofnewyork.us/d/tg4x-b46p',
        validation: 'Official dataset page and resource endpoint resolve. A nonempty August 15 sample and the proposed field names have not yet been proven in this evaluation.',
        uniqueSignal: 'Potential film-specific details such as production category, subcategory, permit locations and parking-held information that TVPP may not expose fully.',
        overlapRisk: 'Likely partial overlap with TVPP Production Event rows. Project titles may be disguised, and one permit may contain several streets or parking segments.',
        safeNextStep: 'Run a read-only August sample in a shadow artifact. Compare permit/event identity, date, borough and normalized street segments before considering any review-lane import.',
        caution: 'Do not promote solely because parking text is long. Require a valid permit date window and a verified NYC location; filming data can change close to shoot day.'
      },
      {
        decision: 'test',
        decisionLabel: 'SHADOW TEST',
        connected: false,
        sourceName: 'DOB NOW: Build – Approved Permits',
        agencyLane: 'Infrastructure corroboration',
        datasetId: 'rbx6-tga4',
        endpoint: 'https://data.cityofnewyork.us/resource/rbx6-tga4.json',
        datasetPage: 'https://data.cityofnewyork.us/d/rbx6-tga4',
        validation: 'Official dataset and endpoint are active. Sample rows include house number, street name, approved/issued/expired dates, work type, job description and coordinates.',
        uniqueSignal: 'Possible evidence of stage, tent, TPA or grandstand work at an event address. This is corroboration data, not a standalone event feed.',
        overlapRisk: 'Very high noise because the dataset covers general construction permits citywide. issued_date is not automatically the event date, and a same-day address match can be false.',
        safeNextStep: 'Shadow-test only. Normalize house number + street + borough, filter temporary-infrastructure keywords, and require the permit to be active near the event date. Never join on issued_date = event date alone.',
        caution: 'A keyword hit in job_description is evidence, not proof that the permit supports the public event. Keep the result as a photographer hint until manually confirmed.'
      },
      {
        decision: 'reject',
        decisionLabel: 'NOT 2026-READY',
        connected: false,
        sourceName: 'Public Programs Division Special Events',
        agencyLane: 'Parks historical program records',
        datasetId: '6v4b-5gp4',
        endpoint: 'https://data.cityofnewyork.us/resource/6v4b-5gp4.json',
        datasetPage: 'https://data.cityofnewyork.us/d/6v4b-5gp4',
        validation: 'The endpoint is active, but returned records use date_and_time and include 2019 examples. The proposed start_date_time/end_date_time schema does not match the observed data.',
        uniqueSignal: 'Attendance, classification, audience and program-category fields could be useful only if a current replacement or refreshed dataset is found.',
        overlapRisk: 'High risk of stale and duplicative information. It is not evidence of an August 2026 commercial pop-up merely because the endpoint still responds.',
        safeNextStep: 'Do not integrate. Search for a current Parks commercial-event or permit dataset and prove its latest event date before reconsidering.',
        caution: 'A live URL is not the same as live 2026 coverage. Historical rows must never enter the Shoot-Day Certified Pack.'
      }
    ];
  }

  window.NYCIF_CANDIDATE_SOURCE_EVALUATION_V01 = {
    VERSION,
    VALIDATED_ON,
    candidates
  };
})();
