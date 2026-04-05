# Matrix Benchmark Summary

Source: `/home/ubuntu/fyp/PrivacyCalling/data/matrix-1775300745300/matrix-aggregate.json`

| Virtual Count | Avg Create Success Rate | Avg Terminal Completed Rate | Avg Peak RSS (MB) |
|---:|---:|---:|---:|
| 10 | 0.0996 | 0.9689 | 74.00 |
| 20 | 0.2277 | 0.9386 | 71.97 |
| 30 | 0.3706 | 0.9320 | 64.67 |

## Quick Findings

1. Create success rate is strongly constrained by virtual pool size and decreases as online users rise.
2. Terminal completed rate remains relatively high after call creation, indicating front-stage capacity is the dominant bottleneck.
3. Server load/core remains low in this dataset, suggesting signaling/resource policy limits are reached before CPU saturation.

