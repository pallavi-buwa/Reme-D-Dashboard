function extractSignals(data) {
  const signals = {};
  const issueTypes = Array.isArray(data.issue_type) ? data.issue_type : [];

  // Use partial matching so both old and new option strings still resolve correctly
  signals.pcr_failure        = issueTypes.some(t => t.includes('No amplification'));
  signals.control_failure    = issueTypes.some(t => t.includes('IC') || t.includes('Internal Control'))
                               || data.ic_amplified === 'No' || data.ic_valid === 'No';
  signals.late_amplification = issueTypes.some(t => t.includes('Late CT'));
  signals.abnormal_curve     = issueTypes.some(t => t.includes('Abnormal curve'));
  signals.nc_amplification   = issueTypes.some(t => t.includes('Negative Control') || t.includes('NC amplification'));
  signals.low_rfu_detected   = issueTypes.some(t => t.includes('Low RFU') || t.includes('Low signal'))
                               || data.low_rfu === 'Yes';
  signals.error_message      = issueTypes.some(t => t.includes('error message') || t.includes('Error message'));

  // Device status — supports both old and new option wording
  signals.critical_device_failure = data.device_status === 'Not working/Completely non-functional'
                                    || data.device_status === 'Not working';
  signals.partial_device_failure  = data.device_status === 'Partially functional (major features failing)'
                                    || data.device_status === 'Partially functional';
  signals.minor_device_failure    = data.device_status === 'Functional with minor features failing'
                                    || data.device_status === 'Minor issues';
  signals.power_failure           = data.power_issue === 'Yes';

  // Consistency — supports both old and new wording
  signals.all_samples_affected      = data.issue_consistency === 'Consistent across all samples'
                                      || data.issue_consistency === 'All samples';
  signals.multiple_samples_affected = data.issue_consistency === 'Only specific samples (multiple)'
                                      || data.issue_consistency === 'Multiple samples';
  signals.single_sample_affected    = data.issue_consistency === 'Only 1 sample'
                                      || data.issue_consistency === 'Single sample';

  signals.protocol_deviation = data.protocol_followed === 'No';
  signals.reagent_mishandled = data.reagent_storage === 'No';
  signals.expired_reagents   = data.reagent_expiry === 'No';
  signals.protocol_changed   = data.protocol_changes === 'Yes';

  // Lab context
  signals.hospital_context   = data.lab_type === 'Hospital';
  signals.blood_bank_context = data.lab_type === 'Blood Bank';

  // Device type — includes new "Portable PCR mini"
  signals.pcr_device        = ['PseeR 16', 'PseeR 32', 'Portable PCR', 'Portable PCR mini'].includes(data.device);
  signals.extraction_device = data.device === 'Extractor';

  // New control-level signals
  signals.ic_failure                    = data.ic_amplified === 'No' || data.ic_valid === 'No';
  signals.positive_control_failure      = data.positive_control_run === 'Yes'
                                          && data.positive_control_amplified === 'No';
  signals.negative_control_contaminated = data.negative_control_run === 'Yes'
                                          && data.negative_control_amplified === 'Yes';

  // Compound signals
  signals.critical_patient_risk  = signals.hospital_context && signals.critical_device_failure;
  signals.systemic_assay_failure  = signals.control_failure && signals.all_samples_affected;
  signals.complete_pcr_failure    = signals.pcr_failure && data.fam_curve_visible === 'No';

  return signals;
}

module.exports = { extractSignals };
