CREATE TABLE "AmlAlert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alertType" text NOT NULL,
	"severity" text NOT NULL,
	"borrowerId" uuid,
	"loanId" uuid,
	"repaymentId" uuid,
	"triggeredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ruleCode" text NOT NULL,
	"description" text NOT NULL,
	"evidenceJson" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"reviewedAt" timestamp with time zone,
	"reviewedById" uuid,
	"resolutionNotes" text,
	"ficReportId" text,
	"evidencePath" text
);
--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"userId" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entityId" text,
	"ipAddress" text,
	"userAgent" text,
	"prevHash" text,
	"hash" text,
	"meta" text
);
--> statement-breakpoint
CREATE TABLE "BeneficialOwner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entityBorrowerId" uuid NOT NULL,
	"uboBorrowerId" uuid NOT NULL,
	"ownershipPct" double precision NOT NULL,
	"acquiredOn" timestamp with time zone,
	"verified" boolean DEFAULT false NOT NULL,
	"verifiedAt" timestamp with time zone,
	"verifiedById" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "BorrowerAddress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrowerId" uuid NOT NULL,
	"type" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text,
	"province" text,
	"country" text DEFAULT 'Zambia' NOT NULL,
	"fromDate" timestamp with time zone,
	"toDate" timestamp with time zone,
	"isCurrent" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Borrower" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrowerNo" text NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"middleName" text,
	"dateOfBirth" timestamp with time zone,
	"gender" text,
	"maritalStatus" text,
	"nationality" text DEFAULT 'Zambian' NOT NULL,
	"nrcNumber" text,
	"passportNumber" text,
	"phone" text NOT NULL,
	"phoneAlt" text,
	"email" text,
	"addressLine1" text,
	"addressLine2" text,
	"city" text,
	"province" text,
	"district" text,
	"geoLat" double precision,
	"geoLng" double precision,
	"employmentStatus" text,
	"employerName" text,
	"occupation" text,
	"monthlyIncomeZMW" double precision,
	"kycStatus" text DEFAULT 'PENDING' NOT NULL,
	"kycRiskRating" text DEFAULT 'MEDIUM' NOT NULL,
	"kycReviewedAt" timestamp with time zone,
	"kycReviewerId" uuid,
	"kycExpiresAt" timestamp with time zone,
	"pepFlag" boolean DEFAULT false NOT NULL,
	"sanctionsFlag" boolean DEFAULT false NOT NULL,
	"isBeneficialOwner" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"blacklistReason" text,
	"branchId" uuid,
	"assignedOfficerId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdById" uuid,
	"notes" text,
	CONSTRAINT "Borrower_borrowerNo_unique" UNIQUE("borrowerNo")
);
--> statement-breakpoint
CREATE TABLE "BozReport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reportType" text NOT NULL,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone NOT NULL,
	"generatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"generatedById" uuid,
	"payloadJson" text NOT NULL,
	"payloadSha256" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"totalCapitalZMW" double precision,
	"totalRiskWeightedAssetsZMW" double precision,
	"capitalAdequacyRatio" double precision,
	"liquidAssetsZMW" double precision,
	"liquidityRatio" double precision,
	"nplRatio" double precision,
	"metricsJson" text,
	"filePath" text,
	"submittedToBoz" boolean DEFAULT false NOT NULL,
	"submittedAt" timestamp with time zone,
	"bozReference" text
);
--> statement-breakpoint
CREATE TABLE "Branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"province" text,
	"city" text,
	"address" text,
	"phone" text,
	"email" text,
	"bozBranchCode" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Branch_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "CtrRecord" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alertId" uuid NOT NULL,
	"borrowerId" uuid,
	"customerName" text NOT NULL,
	"customerNrc" text,
	"amountZMW" double precision NOT NULL,
	"amountUSD" double precision NOT NULL,
	"transactionDate" timestamp with time zone NOT NULL,
	"transactionType" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"submittedAt" timestamp with time zone,
	"ficRef" text,
	"goamlXmlPath" text,
	CONSTRAINT "CtrRecord_alertId_unique" UNIQUE("alertId")
);
--> statement-breakpoint
CREATE TABLE "KycDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrowerId" uuid NOT NULL,
	"type" text NOT NULL,
	"documentNo" text,
	"issuer" text,
	"issuedOn" timestamp with time zone,
	"expiresOn" timestamp with time zone,
	"fileName" text NOT NULL,
	"fileMime" text NOT NULL,
	"fileSize" integer NOT NULL,
	"storagePath" text NOT NULL,
	"fileSha256" text NOT NULL,
	"ocrText" text,
	"verified" boolean DEFAULT false NOT NULL,
	"verifiedAt" timestamp with time zone,
	"verifiedById" uuid,
	"riskNotes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KycRiskAssessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrowerId" uuid NOT NULL,
	"assessedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"assessedById" uuid,
	"riskRating" text NOT NULL,
	"countryRiskScore" integer DEFAULT 0 NOT NULL,
	"productRiskScore" integer DEFAULT 0 NOT NULL,
	"customerRiskScore" integer DEFAULT 0 NOT NULL,
	"transactionRiskScore" integer DEFAULT 0 NOT NULL,
	"totalScore" integer DEFAULT 0 NOT NULL,
	"findings" text,
	"decision" text NOT NULL,
	"decisionReason" text,
	"reviewDate" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "LoanApplication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicationNo" text NOT NULL,
	"borrowerId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"requestedAmountZMW" double precision NOT NULL,
	"requestedTermMonths" integer NOT NULL,
	"purpose" text NOT NULL,
	"purposeDetail" text,
	"creditScore" integer,
	"creditGrade" text,
	"creditFactors" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"approvedAmountZMW" double precision,
	"approvedTermMonths" integer,
	"approvedRatePct" double precision,
	"rejectionReason" text,
	"assignedOfficerId" uuid,
	"submittedAt" timestamp with time zone,
	"decisionedAt" timestamp with time zone,
	"decidedById" uuid,
	"disbursedAt" timestamp with time zone,
	"disbursementMethod" text,
	"loanId" uuid,
	"altDataSnapshot" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "LoanApplication_applicationNo_unique" UNIQUE("applicationNo"),
	CONSTRAINT "LoanApplication_loanId_unique" UNIQUE("loanId")
);
--> statement-breakpoint
CREATE TABLE "LoanApproval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicationId" uuid NOT NULL,
	"approverId" uuid NOT NULL,
	"level" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"decidedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LoanProduct" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"interestRateAnnualPct" double precision NOT NULL,
	"interestMethod" text NOT NULL,
	"minTermMonths" integer DEFAULT 1 NOT NULL,
	"maxTermMonths" integer DEFAULT 36 NOT NULL,
	"minAmountZMW" double precision NOT NULL,
	"maxAmountZMW" double precision NOT NULL,
	"disbursementChannels" text NOT NULL,
	"repaymentFrequency" text NOT NULL,
	"gracePeriodDays" integer DEFAULT 0 NOT NULL,
	"applicationFeeZMW" double precision DEFAULT 0 NOT NULL,
	"processingFeePct" double precision DEFAULT 0 NOT NULL,
	"requiresCollateral" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "LoanProduct_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loanNo" text NOT NULL,
	"borrowerId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"branchId" uuid,
	"principalZMW" double precision NOT NULL,
	"interestRateAnnualPct" double precision NOT NULL,
	"interestMethod" text NOT NULL,
	"termMonths" integer NOT NULL,
	"disbursedAt" timestamp with time zone,
	"disbursementChannel" text,
	"disbursementRef" text,
	"repaymentFrequency" text NOT NULL,
	"installmentZMW" double precision NOT NULL,
	"totalRepayableZMW" double precision NOT NULL,
	"firstPaymentDue" timestamp with time zone,
	"maturityDate" timestamp with time zone,
	"status" text DEFAULT 'PENDING_DISBURSEMENT' NOT NULL,
	"daysInArrears" integer DEFAULT 0 NOT NULL,
	"principalOutstandingZMW" double precision DEFAULT 0 NOT NULL,
	"interestOutstandingZMW" double precision DEFAULT 0 NOT NULL,
	"feesOutstandingZMW" double precision DEFAULT 0 NOT NULL,
	"totalOutstandingZMW" double precision DEFAULT 0 NOT NULL,
	"ifrs9Stage" integer DEFAULT 1 NOT NULL,
	"eclProvisionZMW" double precision DEFAULT 0 NOT NULL,
	"restructureCount" integer DEFAULT 0 NOT NULL,
	"collateral" text,
	"collateralValueZMW" double precision,
	"pricingOverrideReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"closedAt" timestamp with time zone,
	CONSTRAINT "Loan_loanNo_unique" UNIQUE("loanNo")
);
--> statement-breakpoint
CREATE TABLE "MobileMoneyTransaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"externalId" text,
	"direction" text NOT NULL,
	"amountZMW" double precision NOT NULL,
	"feesZMW" double precision DEFAULT 0 NOT NULL,
	"msisdn" text NOT NULL,
	"accountRef" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"failureReason" text,
	"repaymentId" uuid,
	"webhookSignature" text,
	"initiatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmedAt" timestamp with time zone,
	"rawCallback" text,
	CONSTRAINT "MobileMoneyTransaction_repaymentId_unique" UNIQUE("repaymentId")
);
--> statement-breakpoint
CREATE TABLE "NextOfKin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrowerId" uuid NOT NULL,
	"fullName" text NOT NULL,
	"relationship" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"isPrimary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"borrowerId" uuid,
	"channel" text NOT NULL,
	"recipient" text,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"sentAt" timestamp with time zone,
	"deliveredAt" timestamp with time zone,
	"failureReason" text,
	"relatedEntity" text,
	"relatedEntityId" text,
	"scheduledAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RepaymentSchedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loanId" uuid NOT NULL,
	"installmentNo" integer NOT NULL,
	"dueDate" timestamp with time zone NOT NULL,
	"principalDue" double precision NOT NULL,
	"interestDue" double precision NOT NULL,
	"feesDue" double precision NOT NULL,
	"totalDue" double precision NOT NULL,
	"principalPaid" double precision DEFAULT 0 NOT NULL,
	"interestPaid" double precision DEFAULT 0 NOT NULL,
	"feesPaid" double precision DEFAULT 0 NOT NULL,
	"totalPaid" double precision DEFAULT 0 NOT NULL,
	"paidAt" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Repayment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiptNo" text NOT NULL,
	"loanId" uuid NOT NULL,
	"installmentId" uuid,
	"recordedById" uuid NOT NULL,
	"principalPaidZMW" double precision NOT NULL,
	"interestPaidZMW" double precision NOT NULL,
	"feesPaidZMW" double precision NOT NULL,
	"totalPaidZMW" double precision NOT NULL,
	"paymentMethod" text NOT NULL,
	"paymentChannel" text,
	"externalRef" text,
	"paidByName" text,
	"paidByRelation" text,
	"status" text DEFAULT 'POSTED' NOT NULL,
	"reversedAt" timestamp with time zone,
	"reversedReason" text,
	"triggersCtr" boolean DEFAULT false NOT NULL,
	"triggersStr" boolean DEFAULT false NOT NULL,
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"postedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "Repayment_receiptNo_unique" UNIQUE("receiptNo")
);
--> statement-breakpoint
CREATE TABLE "StrRecord" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alertId" uuid NOT NULL,
	"borrowerId" uuid,
	"subjectName" text NOT NULL,
	"suspicionSummary" text NOT NULL,
	"amountZMW" double precision,
	"filingReason" text NOT NULL,
	"filingDeadline" timestamp with time zone,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"submittedAt" timestamp with time zone,
	"ficRef" text,
	"goamlXmlPath" text,
	CONSTRAINT "StrRecord_alertId_unique" UNIQUE("alertId")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"fullName" text NOT NULL,
	"phone" text,
	"role" text NOT NULL,
	"branchId" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"failedLoginCount" integer DEFAULT 0 NOT NULL,
	"lastLoginAt" timestamp with time zone,
	"fitProperStatus" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "AmlAlert_status_idx" ON "AmlAlert" USING btree ("status");--> statement-breakpoint
CREATE INDEX "AmlAlert_alertType_idx" ON "AmlAlert" USING btree ("alertType");--> statement-breakpoint
CREATE INDEX "AmlAlert_triggeredAt_idx" ON "AmlAlert" USING btree ("triggeredAt");--> statement-breakpoint
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog" USING btree ("entity","entityId");--> statement-breakpoint
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog" USING btree ("occurredAt");--> statement-breakpoint
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "BeneficialOwner_entity_ubo_idx" ON "BeneficialOwner" USING btree ("entityBorrowerId","uboBorrowerId");--> statement-breakpoint
CREATE INDEX "BeneficialOwner_uboBorrowerId_idx" ON "BeneficialOwner" USING btree ("uboBorrowerId");--> statement-breakpoint
CREATE INDEX "Borrower_nrcNumber_idx" ON "Borrower" USING btree ("nrcNumber");--> statement-breakpoint
CREATE INDEX "Borrower_phone_idx" ON "Borrower" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "Borrower_lastName_firstName_idx" ON "Borrower" USING btree ("lastName","firstName");--> statement-breakpoint
CREATE INDEX "Borrower_kycStatus_idx" ON "Borrower" USING btree ("kycStatus");--> statement-breakpoint
CREATE INDEX "Borrower_branchId_idx" ON "Borrower" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "KycDocument_borrowerId_idx" ON "KycDocument" USING btree ("borrowerId");--> statement-breakpoint
CREATE INDEX "KycDocument_type_idx" ON "KycDocument" USING btree ("type");--> statement-breakpoint
CREATE INDEX "LoanApplication_borrowerId_idx" ON "LoanApplication" USING btree ("borrowerId");--> statement-breakpoint
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Loan_borrowerId_idx" ON "Loan" USING btree ("borrowerId");--> statement-breakpoint
CREATE INDEX "Loan_status_idx" ON "Loan" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Loan_branchId_idx" ON "Loan" USING btree ("branchId");--> statement-breakpoint
CREATE INDEX "Loan_ifrs9Stage_idx" ON "Loan" USING btree ("ifrs9Stage");--> statement-breakpoint
CREATE INDEX "MobileMoneyTransaction_externalId_idx" ON "MobileMoneyTransaction" USING btree ("externalId");--> statement-breakpoint
CREATE INDEX "MobileMoneyTransaction_status_idx" ON "MobileMoneyTransaction" USING btree ("status");--> statement-breakpoint
CREATE INDEX "Notification_userId_idx" ON "Notification" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Notification_status_idx" ON "Notification" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "RepaymentSchedule_loan_installment_idx" ON "RepaymentSchedule" USING btree ("loanId","installmentNo");--> statement-breakpoint
CREATE INDEX "RepaymentSchedule_dueDate_status_idx" ON "RepaymentSchedule" USING btree ("dueDate","status");--> statement-breakpoint
CREATE INDEX "Repayment_loanId_idx" ON "Repayment" USING btree ("loanId");--> statement-breakpoint
CREATE INDEX "Repayment_receivedAt_idx" ON "Repayment" USING btree ("receivedAt");--> statement-breakpoint
CREATE INDEX "User_role_idx" ON "User" USING btree ("role");--> statement-breakpoint
CREATE INDEX "User_branchId_idx" ON "User" USING btree ("branchId");