#!/bin/bash
# mix.sh video music dur extra_inputs filter_prefix out
V=$1; MU=$2; D=$3; OUT=$4; CL=$5
if [ -n "$CL" ]; then
 PRE="[1:a]atrim=0:$D,afade=t=in:d=0.3,afade=t=out:st=$(python3 -c "print($D-1.2)"):d=1.2,volume=0.8[m];[2:a]volume=0.8[c];[m][c]amix=inputs=2:normalize=0[mx]"; EXTRA="-i $CL"
else
 PRE="[1:a]atrim=0:$D,afade=t=in:d=0.3,afade=t=out:st=$(python3 -c "print($D-1.2)"):d=1.2[mx]"; EXTRA=""
fi
J=$(ffmpeg -nostdin -loglevel info -i $V -i $MU $EXTRA -filter_complex "$PRE;[mx]loudnorm=I=-13.5:TP=-3:LRA=7:print_format=json[a]" -map "[a]" -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -nostdin -y -loglevel error -i $V -i $MU $EXTRA -filter_complex "$PRE;[mx]loudnorm=I=-13.5:TP=-3:LRA=7:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,alimiter=limit=0.68:level=0,aresample=48000[a]" -map 0:v -map "[a]" -t $D -c:v copy -c:a aac -b:a 192k $OUT
ffmpeg -nostdin -i $OUT -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)" | tail -2
