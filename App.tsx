import { createRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Camera } from "expo-camera";
import { cameraWithTensors } from "@tensorflow/tfjs-react-native";

/**
 * TensorflowCamera를 통해 얼굴을 측정하는 컴포넌트 
 * @returns 
 */
const App: React.FC = () => {

  // expo-camera를 통해서 TensorCamera를 구성한다.
  const TensorCamera = cameraWithTensors(Camera);

  // TensorCamera의 엘리먼트 정보를 가져온다.
  const tensorCameraRef = createRef<any>();

  // TensorCamera의 미리보기 운영체제 별 너비/높이 지정
  const textureDims = Platform.OS === "ios" ? { height: 1920, width: 1080 } : { height: 1200, width: 1600 };

  // 원하는 카메라의 사이즈를 지정한다.
  const CAMERA_SIZE = { height: 720, width: 540 }


  /**
   * TensorCamera가 특정 시간 마다 루프를 돌면서 측정된 값을 반환 해줌.
   * @param images : 카메라 이미지를 나타내는 텐서를 생성
   * @param updatePreview : WebGL 렌더 버퍼를 카메라의 내용으로 업데이트하는 함수
   * @param gl : 렌더링을 수행하는 데 사용되는 ExpoWebGl 컨텍스트
   */
  const fn_onReadyTensorCamera = async (images: any, updatePreview: any, gl: any) => {

    const loop = async () => {

      // TensorCamera에서 루프를 돌면서 나온 텐서 이미지 
      const nextImageTensor = images.next().value;

      // 2초간 반복적으로 루프를 반복한다.
      setTimeout(() => {
        requestAnimationFrame(loop);
      }, 1000);
    }
    loop();
  }

  return (
    <View style={styles.container}>
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
    </View>
  )
}
export default App;


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    position: "absolute"
  },
});
