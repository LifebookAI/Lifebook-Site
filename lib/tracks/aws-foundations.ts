import type { StudyTrack } from './types';

export const AWS_FOUNDATIONS_TRACK: StudyTrack = {
  id: 'aws-foundations-j1',
  slug: 'aws-foundations-j1',
  title: 'AWS Foundations — J1 Lab Companion',
  subtitle: 'Week 1–2: S3, CloudFront, IAM, EC2, VPC basics',
  description:
    'Guided labs that mirror your AWS “Week 1–2” portfolio: private S3 + CloudFront OAC, versioning + lifecycle, cross-region replication, and IAM/EC2/VPC fundamentals. Each step ends in a saved artifact in your Library.',
  level: 'beginner',
  journeyKey: 'j1-aws-lab-companion',
  estimatedMinutesTotal: 240,
  tags: ['aws', 'cloud', 'foundations', 'labs'],
  steps: [
    {
      id: 'aws-s3-oac-versioning',
      slug: 'aws-s3-oac-versioning',
      title: 'Private S3 + CloudFront OAC & Versioning',
      summary:
        'Build a private S3 bucket fronted by CloudFront with OAC, enable versioning, and add lifecycle rules for non-current versions. Capture notes + screenshots and save a “Lab 1” artifact.',
      estimatedMinutes: 60,
      workflowTemplateId: 'aws-s3-oac-lab-v1',
      journeyKey: 'j1-aws-lab-companion',
    },
    {
      id: 'aws-s3-crr-kms',
      slug: 'aws-s3-crr-kms',
      title: 'Cross-Region Replication with SSE-KMS',
      summary:
        'Configure CRR from a source bucket in us-east-1 to a destination bucket in another region with independent KMS keys. Validate replication and lifecycle for replicated objects.',
      estimatedMinutes: 45,
      workflowTemplateId: 'aws-s3-crr-lab-v1',
      journeyKey: 'j1-aws-lab-companion',
    },
    {
      id: 'aws-iam-basics',
      slug: 'aws-iam-basics',
      title: 'IAM Least Privilege for S3 & CloudFront',
      summary:
        'Design IAM policies and roles that restrict access to your S3/CloudFront lab resources. Capture a short explanation of why each permission is needed.',
      estimatedMinutes: 45,
      workflowTemplateId: 'aws-iam-lab-v1',
      journeyKey: 'j1-aws-lab-companion',
    },
    {
      id: 'aws-ec2-vpc-basics',
      slug: 'aws-ec2-vpc-basics',
      title: 'EC2 + VPC Basics',
      summary:
        'Launch a small EC2 instance in a VPC with public/private subnets and security groups. Document connectivity patterns and risks.',
      estimatedMinutes: 45,
      workflowTemplateId: 'aws-ec2-vpc-lab-v1',
      journeyKey: 'j1-aws-lab-companion',
    },
    {
      id: 'aws-lab-retro',
      slug: 'aws-lab-retro',
      title: 'Week 1–2 Lab Retrospective',
      summary:
        'Summarize what you built, what broke, and what you would do differently. Export a polished “AWS Week 1–2 Lab Summary” artifact.',
      estimatedMinutes: 45,
      workflowTemplateId: 'aws-lab-retro-v1',
      journeyKey: 'j1-aws-lab-companion',
    },
  ],
};
