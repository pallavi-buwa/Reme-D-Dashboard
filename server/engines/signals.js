function extractSignals(data) {
  const signals = {};

  const issueTypes = Array.isArray(data.issue_type) ? data.issue_type : [];

  signals.pcr_failure = issueTypes.includes('No amplification');
  signals.control_failure = issueTypes.includes('IC failure') || data.ic_valid === 'No';
  signals.late_amplification = issueTypes.includes('Late CT');
  signals.abnormal_curve = issueTypes.includes('Abnormal curve');
  signals.nc_amplification = issueTypes.includes('NC amplification');
  signals.low_rfu_detected = issueTypes.includes('Low RFU') || data.low_rfu === 'Yes';
  signals.error_message = issueTypes.includes('Error message');

  signals.critical_device_failure = data.device_status === 'Not working';
  signals.partial_device_failure = data.device_status === 'Partially functional';
  signals.power_failure = data.power_issue === 'Yes';

  signals.all_samples_affected = data.issue_consistency === 'All samples';
  signals.protocol_deviation = data.protocol_followed === 'No';
  signals.reagent_mishandled = data.reagent_storage === 'No';
  signals.expired_reagents = data.reagent_expiry === 'No';

  signals.hospital_context = data.lab_type === 'Hospital';
  signals.blood_bank_context = data.lab_type === 'Blood Bank';

  signals.pcr_device = ['PseeR 16', 'PseeR 32', 'Portable PCR'].includes(data.device);
  signals.extraction_device = data.device === 'Extractor';

  // Compound signals
  signals.critical_patient_risk =
    signals.hospital_context && signals.critical_device_failure;
  signals.systemic_assay_failure =
    signals.control_failure && signals.all_samples_affected;
  signals.complete_pcr_failure =
    signals.pcr_failure && data.fam_curve_visible === 'No';

  return signals;
}

module.exports = { extractSignals };
