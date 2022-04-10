import { createRef, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Camera } from "expo-camera";
import { cameraWithTensors } from "@tensorflow/tfjs-react-native";
import Canvas from 'react-native-canvas';

// Tensorflow 
import * as tf from "@tensorflow/tfjs";
// Tensorflow blazeface 모델을 가져온다.
import * as blazeface from '@tensorflow-models/blazeface';

interface LoadModel {
  isTfReady: boolean,
  blazefaceModel: blazeface.BlazeFaceModel | null
}

/**
 * TensorflowCamera를 통해 얼굴을 측정하는 컴포넌트 
 * @returns 
 */
const App: React.FC = () => {

  // expo-camera를 통해서 TensorCamera를 구성한다.
  const TensorCamera = cameraWithTensors(Camera);

  // TensorCamera의 엘리먼트 정보를 위해 구성한다.
  const tensorCameraRef: React.RefObject<any> = createRef<any>();

  // 얼굴 감추기 / 숨기기 혹은 네모 그려주기 기능에 사용되는 캔버스 
  const canvasRef: React.RefObject<Canvas> = createRef<Canvas>();

  // TensorCamera의 미리보기 운영체제 별 너비/높이 지정
  const textureDims = Platform.OS === "ios" ? { height: 1920, width: 1080 } : { height: 1200, width: 1600 };

  // 원하는 카메라의 사이즈를 지정한다.
  const CAMERA_SIZE = { height: 480, width: 320 };

  const [initSetting, setInitSetting] = useState<LoadModel>({
    isTfReady: false,
    blazefaceModel: null
  })

  useEffect(() => {
    (async () => {
      await fn_initSetting();
    })()
  }, [])

  /**
   * 초기 세팅
   * [기능-1] 카메라 권한 체크 
   * [기능-2] Tensorflow.js Ready
   * [기능-3] blazeface 모델을 불러와서 측정을 수행한다
   * @returns {Promise<void>}
   */
  const fn_initSetting = async (): Promise<void> => {

    let _isTensorReady: boolean = false;
    let _blazeface: blazeface.BlazeFaceModel | null = null;

    // [기능-1] 카메라 권한 체크 
    const { status } = (await Camera.requestCameraPermissionsAsync())
    if (status !== 'granted') {
      throw Error(`[-] 카메라의 권한 요청이 승인 되지 않았습니다:`);
    }

    // [기능-2] Tensorflow.js Ready
    await tf.setBackend('rn-webgl')
      .then(() => {
        _isTensorReady = true;
        tf.engine().startScope();   // 모든 텐서와 백엔드를 추적하는 엔진 영역을 만듬.
        console.log("[+] Load Tensorflow.js....");
      })
      .catch((error) => {
        throw Error(`[-] Tensorflow Ready Error: ${error}`);
      });

    // [기능-3] blazeface 모델을 불러와서 측정을 수행한다
    await blazeface.load()
      .then((_blazefaceModel) => {
        _blazeface = _blazefaceModel
      })
      .catch((error) => {
        throw Error(`[-] Blazeface Model Load Error: ${error}`);
      });

    // [기능-4] 로드 된 값 State에 세팅
    setInitSetting({
      isTfReady: _isTensorReady,
      blazefaceModel: _blazeface
    });
  }

  /**
   * blazeFace 모델을 통하여 얼굴 측정
   * @param tensorImage 
   * @returns {boolean} 예측 시 true, 미 예측 시 false 반환
   */
  const fn_estimateBlazeFace = async (tensorImage: tf.Tensor3D): Promise<boolean> => {

    let _isEstimate: boolean = false;

    // 텐서 이미지가 존재하는지 체크 
    if (tensorImage && initSetting.blazefaceModel) {
      // [기능-2] blazeface 모델을 통하여 사람 얼굴을 측정
      await initSetting.blazefaceModel.estimateFaces(tensorImage, false, true)
        .then(async (_predictions: blazeface.NormalizedFace[]) => {
          console.log(`[+] 측정 얼굴 수 [${_predictions.length}]`);
          // [CASE1-1] 얼굴을 예측 한 경우 Canvas에 얼굴을 그려준다.
          if (_predictions.length > 0) {
            await fn_drawRect(_predictions); //조정된 위치에 대해서 캔버스에 그려주기 
            _isEstimate = false;
          }
          // [CASE1-2] 얼굴을 예측하지 못한 경우에 Canvas의 내용을 초기화 한다.
          else {
            if (canvasRef.current) canvasRef.current.getContext("2d").clearRect(0, 0, CAMERA_SIZE.width, CAMERA_SIZE.height);
            _isEstimate = false;
          }
        })
        .catch((error: string) => {
          tf.engine().endScope();
          throw Error(`blazeface Estimate Error : ${error}`);
        })
    }
    tensorImage.dispose(); // 사용한 텐서 소멸
    return _isEstimate;
  }

  /**
   * 조정된 위치에 대해서 캔버스에 그려주기 
   * @param predictions 
   */
  const fn_drawRect = async (predictions: any) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');


      for (let i = 0; i < predictions.length; i++) {
        const start = predictions[i].topLeft;
        const end = predictions[i].bottomRight;
        const size = [end[0] - start[0], end[1] - start[1]];

        // 그려 줄 캔버스 사이즈 지정
        canvas.height = CAMERA_SIZE.height;
        canvas.width = CAMERA_SIZE.width;
        ctx.strokeStyle = "red"
        ctx.lineWidth = 6;
        // 화면상에 Rect를 그려준다.
        ctx.strokeRect(start[0], start[1], size[0], size[1]);
      }
    }
  }



  /**
   * TensorCamera가 특정 시간 마다 루프를 돌면서 측정된 값을 반환 해줌.
   * @param images : 카메라 이미지를 나타내는 텐서를 생성
   * @param updatePreview : WebGL 렌더 버퍼를 카메라의 내용으로 업데이트하는 함수
   * @param gl : 렌더링을 수행하는 데 사용되는 ExpoWebGl 컨텍스트
   * @returns {void}
   */
  const fn_onReadyTensorCamera = (images: IterableIterator<tf.Tensor3D>, updatePreview: any, gl: any): void => {

    const loop = async () => {
      // TensorCamera에서 루프를 돌면서 나온 텐서 이미지 
      const _tensorImage: tf.Tensor3D = images.next().value;

      // blazeFace 모델을 통하여 얼굴 측정
      await fn_estimateBlazeFace(_tensorImage)
        .then((isEstimate: boolean) => {
          console.log("얼굴을 예측하였는가?", isEstimate);
        })
        .catch((error) => {
          console.log(error);
        })

      // 2초간 반복적으로 루프를 반복한다.
      setTimeout(() => {
        _tensorImage.dispose();
        requestAnimationFrame(loop);
      }, 2000);
    }
    loop();
  }
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    camera: {
      position: "absolute",
      width: CAMERA_SIZE.width,
      height: CAMERA_SIZE.height,
    },
    canvas: {
      position: "absolute",
      zIndex: 1000000,
    }
  });

  return (
    <View style={styles.container}>
      {
        initSetting.isTfReady && initSetting.blazefaceModel && (
          <>
            <TensorCamera
              ref={tensorCameraRef} // 엘리먼트 정보 
              style={styles.camera} // 스타일 
              type={Camera.Constants.Type.front}  // 카메라의 앞, 뒤 방향
              cameraTextureHeight={textureDims.height}  // 카메라 미리 보기 높이 값
              cameraTextureWidth={textureDims.width}  // 카메라 미리 보기 너비 값
              resizeHeight={CAMERA_SIZE.height} // 출력 카메라 높이
              resizeWidth={CAMERA_SIZE.width}   // 출력 카메라 너비 
              resizeDepth={3} // 출력 텐서의 깊이(채널 수)값. (3 or 4)
              autorender={true} // 뷰가 카메라 내용으로 자동업데이트 되는지 여부. (렌더링 발생시 직접적 제어를 원하면 false 값으로 설정할 것)
              useCustomShadersToResize={false} // 커스텀 셰이더를 사용하여 출력 텐서에 맞는 더 작은 치수로 카메라 이미지의 크기를 조정할지 여부.
              onReady={fn_onReadyTensorCamera} // 컴포넌트가 마운트되고 준비되면 이 콜백이 호출되고 다음 3가지 요소를 받습니다.
            />
            {/* TensorCamera위에 그려줄 Canvas */}
            <Canvas style={styles.canvas} ref={canvasRef} />
          </>
        )
      }
    </View>
  )
}
export default App;
